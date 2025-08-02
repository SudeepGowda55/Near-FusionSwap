use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    env, near_bindgen, AccountId, CryptoHash, Promise, NearToken,
};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::json_types::U128;
use near_sdk::serde_json;
use hex;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Timelocks {
    pub withdrawal: u64,
    pub public_withdrawal: u64,
    pub cancellation: u64,
    pub public_cancellation: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct InitArgs {
    pub receiver_id: AccountId,
    pub resolver_id: AccountId,
    pub hashlock: String,
    pub timelocks: Timelocks,
    pub is_destination: bool,
    pub partial_secrets: Vec<String>,
}

#[derive(BorshDeserialize, BorshSerialize, PartialEq)]
pub enum HtlcStatus {
    Funded,
    Claimed,
    Refunded,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EscrowState {
    pub receiver_id: AccountId,
    pub resolver_id: AccountId,
    pub hashlock: String,
    pub timelocks: Timelocks,
    pub amount: U128,
    pub filled_amount: U128,
    pub status: String,
    pub partial_secrets_count: usize,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EventLog {
    pub event: String,
    pub auction_id: String,
    pub data: EscrowState,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct EscrowSource {
    receiver_id: AccountId,
    resolver_id: AccountId,
    hashlock: CryptoHash,
    hashlock_hex: String, // Store for events
    timelocks: Timelocks,
    partial_secrets: Vec<CryptoHash>,
    amount: u128,
    filled_amount: u128,
    status: HtlcStatus,
    claimed_secrets: Vec<String>, // Track revealed secrets
}

impl Default for EscrowSource {
    fn default() -> Self {
        env::panic_str("Contract should be initialized before usage");
    }
}

#[near_bindgen]
impl EscrowSource {
    #[init]
    pub fn new(args: InitArgs) -> Self {
        assert!(!env::state_exists(), "Already initialized");

        let hashlock_bytes = hex::decode(&args.hashlock).expect("Invalid hashlock hex");
        let hashlock: CryptoHash = hashlock_bytes
            .as_slice()
            .try_into()
            .expect("Invalid hashlock length - must be 32 bytes");

        let partial_secrets = args
            .partial_secrets
            .iter()
            .map(|s| {
                let bytes = hex::decode(s).expect("Invalid partial secret hex");
                bytes.as_slice().try_into().expect("Invalid partial secret length")
            })
            .collect();

        let attached = env::attached_deposit();
        assert!(attached.as_yoctonear() > 0, "Must attach deposit to fund escrow");

        // Validate timelock sequence
        Self::validate_timelock_sequence(&args.timelocks);

        let instance = Self {
            receiver_id: args.receiver_id.clone(),
            resolver_id: args.resolver_id.clone(),
            hashlock,
            hashlock_hex: args.hashlock.clone(),
            timelocks: args.timelocks.clone(),
            partial_secrets,
            amount: attached.as_yoctonear(),
            filled_amount: 0,
            status: HtlcStatus::Funded,
            claimed_secrets: Vec::new(),
        };

        // Emit creation event
        let event = EventLog {
            event: "escrow_source_created".to_string(),
            auction_id: env::current_account_id().to_string(),
            data: instance.get_state(),
        };
        env::log_str(&serde_json::to_string(&event).unwrap());

        instance
    }

    /// Claim funds with secret (resolver calls this after providing liquidity on destination)
    pub fn claim(&mut self, secret: String) {
        assert_eq!(self.status, HtlcStatus::Funded, "Escrow not in claimable state");

        // Check withdrawal window
        assert!(
            env::block_timestamp() <= self.timelocks.withdrawal,
            "Withdrawal window expired"
        );

        let caller = env::predecessor_account_id();
        assert_eq!(caller, self.resolver_id, "Only resolver can claim from source");

        // Validate secret
        let secret_bytes = hex::decode(&secret).expect("Invalid secret hex");
        let computed_hash = env::sha256(&secret_bytes);
        let computed_hashlock: CryptoHash = computed_hash.as_slice().try_into().unwrap();

        let is_main_secret = self.hashlock == computed_hashlock;
        let is_partial_secret = self.partial_secrets.contains(&computed_hashlock);
        
        assert!(
            is_main_secret || is_partial_secret,
            "Secret does not match any expected hashlock"
        );

        // Prevent double-claiming same secret
        assert!(
            !self.claimed_secrets.contains(&secret),
            "Secret already used"
        );

        // Calculate fill amount
        let fill_amount = if !self.partial_secrets.is_empty() {
            self.amount / (self.partial_secrets.len() as u128)
        } else {
            self.amount
        };

        // Update state
        self.filled_amount += fill_amount;
        self.claimed_secrets.push(secret.clone());

        // Transfer to resolver (reimbursement for providing liquidity on destination)
        Promise::new(self.resolver_id.clone()).transfer(NearToken::from_yoctonear(fill_amount));

        // Mark as fully claimed if complete
        if self.filled_amount >= self.amount || is_main_secret {
            self.status = HtlcStatus::Claimed;
        }

        // Emit claim event
        let event = EventLog {
            event: "escrow_source_claimed".to_string(),
            auction_id: env::current_account_id().to_string(),
            data: self.get_state(),
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
        env::log_str(&format!("Secret revealed: {}", secret));
    }

    /// Refund funds after timeout (resolver calls this if destination swap fails)
    pub fn refund(&mut self) {
        assert_eq!(self.status, HtlcStatus::Funded, "Escrow not in refundable state");
        assert!(
            env::block_timestamp() > self.timelocks.cancellation,
            "Cancellation period not reached"
        );

        let caller = env::predecessor_account_id();
        assert_eq!(caller, self.resolver_id, "Only resolver can refund");

        // Return remaining funds to resolver
        let remaining_amount = self.amount - self.filled_amount;
        if remaining_amount > 0 {
            Promise::new(self.resolver_id.clone()).transfer(NearToken::from_yoctonear(remaining_amount));
        }

        self.status = HtlcStatus::Refunded;

        // Emit refund event
        let event = EventLog {
            event: "escrow_source_refunded".to_string(),
            auction_id: env::current_account_id().to_string(),
            data: self.get_state(),
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
    }

    /// Emergency refund during public cancellation period
    pub fn public_refund(&mut self) {
        assert_eq!(self.status, HtlcStatus::Funded, "Escrow not in refundable state");
        assert!(
            env::block_timestamp() > self.timelocks.public_cancellation,
            "Public cancellation period not reached"
        );

        let remaining_amount = self.amount - self.filled_amount;
        if remaining_amount > 0 {
            Promise::new(self.resolver_id.clone()).transfer(NearToken::from_yoctonear(remaining_amount));
        }

        self.status = HtlcStatus::Refunded;

        let event = EventLog {
            event: "escrow_source_public_refunded".to_string(),
            auction_id: env::current_account_id().to_string(),
            data: self.get_state(),
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
    }

    /// Validate timelock sequence
    fn validate_timelock_sequence(t: &Timelocks) {
        assert!(t.withdrawal < t.public_withdrawal, "Invalid timelock sequence");
        assert!(t.public_withdrawal < t.cancellation, "Invalid timelock sequence");
        assert!(t.cancellation < t.public_cancellation, "Invalid timelock sequence");
    }

    // View methods
    pub fn get_state(&self) -> EscrowState {
        EscrowState {
            receiver_id: self.receiver_id.clone(),
            resolver_id: self.resolver_id.clone(),
            hashlock: self.hashlock_hex.clone(),
            timelocks: self.timelocks.clone(),
            amount: U128(self.amount),
            filled_amount: U128(self.filled_amount),
            status: match self.status {
                HtlcStatus::Funded => "Funded".to_string(),
                HtlcStatus::Claimed => "Claimed".to_string(),
                HtlcStatus::Refunded => "Refunded".to_string(),
            },
            partial_secrets_count: self.partial_secrets.len(),
        }
    }

    pub fn get_status(&self) -> String {
        match self.status {
            HtlcStatus::Funded => "Funded".to_string(),
            HtlcStatus::Claimed => "Claimed".to_string(),
            HtlcStatus::Refunded => "Refunded".to_string(),
        }
    }

    pub fn get_amount(&self) -> U128 {
        U128(self.amount)
    }

    pub fn get_filled_amount(&self) -> U128 {
        U128(self.filled_amount)
    }

    pub fn get_claimed_secrets(&self) -> Vec<String> {
        self.claimed_secrets.clone()
    }
}
