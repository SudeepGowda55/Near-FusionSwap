use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::{env, near_bindgen, AccountId, Promise, CryptoHash, NearToken};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json;
use schemars::JsonSchema;
use tiny_keccak::{Hasher, Keccak};
use hex;

const ERR_INVALID_HASHLOCK_FORMAT: &str = "Invalid hashlock format";
const ERR_INVALID_HASH_LENGTH: &str = "Invalid hash length";
const ERR_INSUFFICIENT_DEPOSIT: &str = "Attached deposit must be greater than 0";
const ERR_HTLC_NOT_FOUND: &str = "HTLC not found";
const ERR_ONLY_RECEIVER_CAN_CLAIM: &str = "Only the receiver can claim";
const ERR_HTLC_NOT_CLAIMABLE: &str = "HTLC is not in a claimable state";
const ERR_HTLC_NOT_REFUNDABLE: &str = "HTLC is not in a refundable state";
const ERR_LOCKTIME_NOT_EXPIRED: &str = "Locktime has not expired";
const SAFETY_DEPOSIT_RATIO: u128 = 10;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, JsonSchema, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum HtlcStatus {
    Funded,
    Claimed,
    Refunded,
}

/// Timelocks for various stages (all in nanoseconds since epoch)
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, JsonSchema, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Timelocks {
    pub withdrawal: u64,
    pub public_withdrawal: u64,
    pub cancellation: u64,
    pub public_cancellation: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, JsonSchema, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Htlc {
    #[schemars(with = "String")]
    pub sender_id: AccountId,      // Maker (user)
    #[schemars(with = "String")]
    pub receiver_id: AccountId,    // Final recipient (maker for destination, resolver for source)
    #[schemars(with = "String")]
    pub resolver_id: AccountId,    // Taker/resolver who fills the swap
    pub hashlock: CryptoHash,
    pub timelocks: Timelocks,      // Multi-stage timelocks (all in nanoseconds)
    #[schemars(with = "String")]
    pub amount: NearToken,
    #[schemars(with = "String")]
    pub safety_deposit: NearToken, // Added for Fusion+ incentives
    pub partial_secrets: Vec<CryptoHash>, // For partial fills
    #[schemars(with = "String")]
    pub filled_amount: NearToken,  // Tracks partial progress
    pub status: HtlcStatus,
    pub is_destination: bool,      // True if NEAR is destination chain
}

#[derive(Serialize, JsonSchema)]
#[serde(crate = "near_sdk::serde")] // Kept your EventLog
pub struct EventLog {
    pub event: String,
    pub data: Htlc,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct HtlcContract {
    pub htlcs: UnorderedMap<String, Htlc>,
}

impl Default for HtlcContract {
    fn default() -> Self {
        Self {
            htlcs: UnorderedMap::new(b"h".to_vec()),
        }
    }
}

#[near_bindgen]
impl HtlcContract {
    #[init]
    pub fn new() -> Self {
        Self::default()
    }

    #[payable]
    pub fn new_htlc(
        &mut self,
        htlc_id: String,
        sender: AccountId,
        receiver: AccountId,
        hashlock: String,
        timelocks: Timelocks, // pass all timelocks
        is_destination: bool,
        partial_secrets_hex: Option<Vec<String>>
    ) {
        let hashlock_bytes = hex::decode(&hashlock).expect(ERR_INVALID_HASHLOCK_FORMAT);
        let crypto_hash: CryptoHash = hashlock_bytes.try_into().expect(ERR_INVALID_HASH_LENGTH);

        // Validate timelock sequence (like EVM)
        Self::validate_timelock_sequence(&timelocks);

        let total_deposit = env::attached_deposit();
        assert!(total_deposit.as_yoctonear() > 0, "{}", ERR_INSUFFICIENT_DEPOSIT);

        // Safety deposit is a percentage of the total amount intended for the HTLC
        let safety_deposit = NearToken::from_yoctonear(total_deposit.as_yoctonear() / (SAFETY_DEPOSIT_RATIO + 1));
        let amount = total_deposit.saturating_sub(safety_deposit);
        assert!(amount.as_yoctonear() > 0, "Amount after deducting safety deposit must be positive");

        let partial_secrets: Vec<CryptoHash> = partial_secrets_hex.unwrap_or_default().iter().map(|s| {
            let bytes = hex::decode(s).expect(ERR_INVALID_HASHLOCK_FORMAT);
            bytes.try_into().expect(ERR_INVALID_HASH_LENGTH)
        }).collect();

        let htlc = Htlc {
            sender_id: sender,
            receiver_id: receiver,
            resolver_id: env::predecessor_account_id(),  // Caller is resolver
            hashlock: crypto_hash,
            timelocks,
            amount,
            safety_deposit,
            partial_secrets,
            filled_amount: NearToken::from_yoctonear(0),
            status: HtlcStatus::Funded,
            is_destination,
        };

        self.htlcs.insert(&htlc_id, &htlc);

        let event = EventLog {
            event: "htlc_created".to_string(),
            data: htlc,
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
    }

    /// Validate timelock sequence (like EVM _validateTimelockSequence)
    fn validate_timelock_sequence(t: &Timelocks) {
        assert!(t.withdrawal < t.public_withdrawal, "Invalid timelock sequence: withdrawal >= public_withdrawal");
        assert!(t.public_withdrawal < t.cancellation, "Invalid timelock sequence: public_withdrawal >= cancellation");
        assert!(t.cancellation < t.public_cancellation, "Invalid timelock sequence: cancellation >= public_cancellation");
    }

    pub fn claim(&mut self, htlc_id: String, secret: String) {
        let secret_bytes = hex::decode(&secret).expect("Invalid secret format");
        let mut hasher = Keccak::v256();
        let mut output = [0u8; 32];
        hasher.update(&secret_bytes);
        hasher.finalize(&mut output);
        let crypto_hash: CryptoHash = output;

        let caller = env::predecessor_account_id();
        let mut htlc = self.htlcs.get(&htlc_id).expect(ERR_HTLC_NOT_FOUND);

        assert_eq!(htlc.status, HtlcStatus::Funded, "{}", ERR_HTLC_NOT_CLAIMABLE);

        // Enforce claim only before withdrawal timelock expiry
        assert!(env::block_timestamp() <= htlc.timelocks.withdrawal, "HTLC withdrawal window expired");

        // Verify secret (single or partial)
        let is_valid = htlc.hashlock == crypto_hash || htlc.partial_secrets.contains(&crypto_hash);
        assert!(is_valid, "Hashlock mismatch");

        // Calculate fill amount (for partial)
        let fill_amount = if !htlc.partial_secrets.is_empty() {
            htlc.amount.saturating_div(htlc.partial_secrets.len() as u128)
        } else {
            htlc.amount
        };

        htlc.filled_amount = htlc.filled_amount.saturating_add(fill_amount);

        // Transfer based on direction
        if htlc.is_destination {
            // NEAR as destination: Unlock to receiver (maker)
            assert_eq!(caller, htlc.receiver_id, "{}", ERR_ONLY_RECEIVER_CAN_CLAIM);
            Promise::new(htlc.receiver_id.clone()).transfer(fill_amount);
        } else {
            // NEAR as source: Unlock to resolver (reimbursement)
            assert_eq!(caller, htlc.resolver_id, "Only resolver can unlock source");
            Promise::new(htlc.resolver_id.clone()).transfer(fill_amount);
        }

        // Return safety deposit to resolver if fully filled
        if htlc.filled_amount >= htlc.amount {
            htlc.status = HtlcStatus::Claimed;
            Promise::new(htlc.resolver_id.clone()).transfer(htlc.safety_deposit);
        }

        self.htlcs.insert(&htlc_id, &htlc);

        let event = EventLog {
            event: "htlc_claimed".to_string(),
            data: htlc.clone(),
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
        env::log_str(&format!("Secret revealed: {}", secret));
    }

    pub fn refund(&mut self, htlc_id: String) {
        let caller = env::predecessor_account_id();
        let mut htlc = self.htlcs.get(&htlc_id).expect(ERR_HTLC_NOT_FOUND);

        assert_eq!(htlc.status, HtlcStatus::Funded, "{}", ERR_HTLC_NOT_REFUNDABLE);
        // Refund only after cancellation timelock
        assert!(env::block_timestamp() > htlc.timelocks.cancellation, "{}", ERR_LOCKTIME_NOT_EXPIRED);
        assert_eq!(caller, htlc.resolver_id, "Only the resolver can refund an expired HTLC");

        // On refund, the entire amount (amount + safety deposit) goes back to the resolver.
        let total_refund = htlc.amount.saturating_add(htlc.safety_deposit);
        Promise::new(htlc.resolver_id.clone()).transfer(total_refund);

        htlc.status = HtlcStatus::Refunded;
        self.htlcs.insert(&htlc_id, &htlc);

        let event = EventLog {
            event: "htlc_refunded".to_string(),
            data: htlc,
        };
        env::log_str(&serde_json::to_string(&event).unwrap());
    }
    
    pub fn get_htlc_details(&self, htlc_id: String) -> Option<Htlc> {
        self.htlcs.get(&htlc_id)
    }

    pub fn verify_keccak256_hash(&self, secret_hex: String, expected_hash_hex: String) -> bool {
        env::log_str(&format!("Verifying secret: {}", secret_hex));
        env::log_str(&format!("Expected hash: {}", expected_hash_hex));

        // Strip optional 0x and decode
        let secret_bytes = match hex::decode(secret_hex.trim_start_matches("0x")) {
            Ok(bytes) => bytes,
            Err(_) => {
                env::log_str("Failed to decode secret from hex.");
                return false;
            }
        };

        let expected_bytes = match hex::decode(expected_hash_hex.trim_start_matches("0x")) {
            Ok(bytes) => bytes,
            Err(_) => {
                env::log_str("Failed to decode expected hash from hex.");
                return false;
            }
        };

        // Compute keccak256(secret)
        let mut hasher = Keccak::v256();
        let mut computed_hash = [0u8; 32];
        hasher.update(&secret_bytes);
        hasher.finalize(&mut computed_hash);

        let computed_hash_hex = hex::encode(computed_hash);
        env::log_str(&format!("Computed hash: 0x{}", computed_hash_hex));

         // Compare
        let result = computed_hash == expected_bytes.as_slice();
        env::log_str(&format!("Match result: {}", result));

        result
    }
}
