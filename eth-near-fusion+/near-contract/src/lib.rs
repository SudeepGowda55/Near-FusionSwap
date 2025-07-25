use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, BorshStorageKey, CryptoHash, PanicOnDefault, Promise,
    Timestamp,
};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Escrows,
    Secrets,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct EscrowOrder {
    pub order_id: String,
    pub maker: AccountId,
    pub taker: AccountId,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: U128,
    pub amount_out: U128,
    pub deadline: U64,
    pub secret_hash: String,
    pub status: EscrowStatus,
    pub created_at: U64,
    pub eth_tx_hash: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum EscrowStatus {
    Created,
    Funded,
    Completed,
    Cancelled,
    Expired,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct CrossChainEscrow {
    pub owner: AccountId,
    pub escrows: UnorderedMap<String, EscrowOrder>,
    pub revealed_secrets: LookupMap<String, String>,
    pub fee_rate: u128, // Fee in basis points (100 = 1%)
}

#[near_bindgen]
impl CrossChainEscrow {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            escrows: UnorderedMap::new(StorageKey::Escrows),
            revealed_secrets: LookupMap::new(StorageKey::Secrets),
            fee_rate: 30, // 0.3% default fee
        }
    }

    /// Create a new escrow for cross-chain swap
    #[payable]
    pub fn create_escrow(
        &mut self,
        order_id: String,
        maker: AccountId,
        taker: AccountId,
        token_in: String,
        token_out: String,
        amount_in: U128,
        amount_out: U128,
        deadline: U64,
        secret_hash: String,
        eth_tx_hash: Option<String>,
    ) -> String {
        let escrow_id = format!("{}_{}", order_id, env::block_timestamp());

        assert!(
            !self.escrows.get(&escrow_id).is_some(),
            "Escrow already exists"
        );

        assert!(
            deadline.0 > env::block_timestamp(),
            "Deadline must be in the future"
        );

        let escrow = EscrowOrder {
            order_id,
            maker,
            taker,
            token_in,
            token_out,
            amount_in,
            amount_out,
            deadline,
            secret_hash,
            status: EscrowStatus::Created,
            created_at: env::block_timestamp().into(),
            eth_tx_hash,
        };

        self.escrows.insert(&escrow_id, &escrow);

        env::log_str(&format!("Escrow created: {}", escrow_id));
        escrow_id
    }

    /// Deposit tokens to fund the escrow
    #[payable]
    pub fn deposit_tokens(&mut self, escrow_id: String) {
        let mut escrow = self.escrows.get(&escrow_id).expect("Escrow not found");

        assert_eq!(
            escrow.status,
            EscrowStatus::Created,
            "Escrow must be in Created status"
        );

        // For NEAR tokens, check attached deposit
        if escrow.token_out == "NEAR" {
            let attached_deposit = env::attached_deposit();
            assert!(
                attached_deposit >= escrow.amount_out.0,
                "Insufficient NEAR attached"
            );
        }

        escrow.status = EscrowStatus::Funded;
        self.escrows.insert(&escrow_id, &escrow);

        env::log_str(&format!("Escrow funded: {}", escrow_id));
    }

    /// Withdraw tokens using the secret
    pub fn withdraw_with_secret(&mut self, escrow_id: String, secret: String) {
        let mut escrow = self.escrows.get(&escrow_id).expect("Escrow not found");

        assert_eq!(escrow.status, EscrowStatus::Funded, "Escrow must be funded");

        assert!(
            env::block_timestamp() <= escrow.deadline.0,
            "Escrow has expired"
        );

        // Verify secret hash
        let secret_hash = self.hash_secret(&secret);
        assert_eq!(secret_hash, escrow.secret_hash, "Invalid secret");

        // Store revealed secret
        self.revealed_secrets.insert(&escrow_id, &secret);

        // Transfer tokens to taker
        if escrow.token_out == "NEAR" {
            Promise::new(escrow.taker.clone()).transfer(escrow.amount_out.0);
        } else {
            // For other tokens, would need to call token contract
            env::log_str("Token transfer would happen here for non-NEAR tokens");
        }

        escrow.status = EscrowStatus::Completed;
        self.escrows.insert(&escrow_id, &escrow);

        env::log_str(&format!(
            "Escrow completed: {}, secret revealed: {}",
            escrow_id, secret
        ));
    }

    /// Cancel escrow after deadline
    pub fn cancel_escrow(&mut self, escrow_id: String) {
        let mut escrow = self.escrows.get(&escrow_id).expect("Escrow not found");

        assert!(
            env::block_timestamp() > escrow.deadline.0,
            "Escrow has not expired yet"
        );

        assert!(
            matches!(escrow.status, EscrowStatus::Created | EscrowStatus::Funded),
            "Escrow cannot be cancelled"
        );

        // Refund to maker if funded
        if escrow.status == EscrowStatus::Funded && escrow.token_out == "NEAR" {
            Promise::new(escrow.maker.clone()).transfer(escrow.amount_out.0);
        }

        escrow.status = EscrowStatus::Cancelled;
        self.escrows.insert(&escrow_id, &escrow);

        env::log_str(&format!("Escrow cancelled: {}", escrow_id));
    }

    /// Emergency withdrawal by owner
    pub fn emergency_withdraw(&mut self, escrow_id: String) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only owner can emergency withdraw"
        );

        let mut escrow = self.escrows.get(&escrow_id).expect("Escrow not found");

        if escrow.status == EscrowStatus::Funded && escrow.token_out == "NEAR" {
            Promise::new(escrow.maker.clone()).transfer(escrow.amount_out.0);
        }

        escrow.status = EscrowStatus::Cancelled;
        self.escrows.insert(&escrow_id, &escrow);

        env::log_str(&format!("Emergency withdrawal: {}", escrow_id));
    }

    // View methods
    pub fn get_escrow(&self, escrow_id: String) -> Option<EscrowOrder> {
        self.escrows.get(&escrow_id)
    }

    pub fn get_order_status(&self, escrow_id: String) -> Option<EscrowStatus> {
        self.escrows.get(&escrow_id).map(|e| e.status)
    }

    pub fn is_secret_revealed(&self, escrow_id: String) -> bool {
        self.revealed_secrets.get(&escrow_id).is_some()
    }

    pub fn get_revealed_secret(&self, escrow_id: String) -> Option<String> {
        self.revealed_secrets.get(&escrow_id)
    }

    // Helper functions
    fn hash_secret(&self, secret: &str) -> String {
        use near_sdk::env::sha256;
        let hash = sha256(secret.as_bytes());
        hex::encode(hash)
    }

    pub fn set_fee_rate(&mut self, fee_rate: u128) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only owner can set fee rate"
        );
        assert!(fee_rate <= 1000, "Fee rate cannot exceed 10%");
        self.fee_rate = fee_rate;
    }
}
