use near_sdk::{
    env, near_bindgen, AccountId, BorshStorageKey, Gas, Promise, PromiseOrValue,
    NearToken, PromiseResult,
};
use near_sdk::collections::UnorderedMap;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json;

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Timelocks {
    pub withdrawal: u64,
    pub public_withdrawal: u64,
    pub cancellation: u64,
    pub public_cancellation: u64,
}

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Escrows,
    EscrowsByType,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct EscrowFactory {
    pub escrows: UnorderedMap<String, AccountId>,
    pub escrows_by_type: UnorderedMap<String, String>, // auction_id -> "source" | "destination"
    pub admin: AccountId,
}

impl Default for EscrowFactory {
    fn default() -> Self {
        Self {
            escrows: UnorderedMap::new(StorageKey::Escrows),
            escrows_by_type: UnorderedMap::new(StorageKey::EscrowsByType),
            admin: env::predecessor_account_id(),
        }
    }
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

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EscrowInfo {
    pub auction_id: String,
    pub escrow_account: AccountId,
    pub escrow_type: String,
    pub created_at: u64,
}

#[near_bindgen]
impl EscrowFactory {
    #[init]
    pub fn new() -> Self {
        Self::default()
    }

    /// Deploy a new escrow_source contract
    #[payable]
    pub fn create_source_escrow(
        &mut self,
        auction_id: String,
        receiver_id: AccountId,
        resolver_id: AccountId,
        hashlock: String,
        timelocks: Timelocks,
        partial_secrets: Option<Vec<String>>,
    ) -> Promise {
        self.validate_timelock_sequence(&timelocks);
        
        let partial_secrets_vec = partial_secrets.unwrap_or_default();
        let subaccount_id = format!("escrow-source-{}.{}", auction_id, env::current_account_id());
        
        // Prevent duplicate escrows
        assert!(
            !self.escrows.contains_key(&auction_id),
            "Escrow for auction_id '{}' already exists",
            auction_id
        );

        let attached_deposit = env::attached_deposit();
        assert!(
            attached_deposit.as_yoctonear() > 0,
            "Must attach deposit to fund escrow"
        );

        // Store escrow info
        self.escrows.insert(&auction_id, &subaccount_id.parse().unwrap());
        self.escrows_by_type.insert(&auction_id, &"source".to_string());

        let init_args = InitArgs {
            receiver_id,
            resolver_id,
            hashlock,
            timelocks,
            is_destination: false,
            partial_secrets: partial_secrets_vec,
        };

        // Deploy contract
        let escrow_source_wasm: &[u8] = include_bytes!("../../escrow_source/res/escrow_source.wasm");
        
        Promise::new(subaccount_id.parse().unwrap())
            .create_account()
            .transfer(attached_deposit)
            .deploy_contract(escrow_source_wasm.to_vec())
            .function_call(
                "new".to_string(),
                serde_json::to_vec(&init_args).unwrap(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(50),
            )
    }

    /// Deploy a new escrow_destination contract
    #[payable]
    pub fn create_destination_escrow(
        &mut self,
        auction_id: String,
        receiver_id: AccountId,
        resolver_id: AccountId,
        hashlock: String,
        timelocks: Timelocks,
        partial_secrets: Option<Vec<String>>,
    ) -> Promise {
        self.validate_timelock_sequence(&timelocks);
        
        let partial_secrets_vec = partial_secrets.unwrap_or_default();
        let subaccount_id = format!("escrow-destination-{}.{}", auction_id, env::current_account_id());
        
        assert!(
            !self.escrows.contains_key(&auction_id),
            "Escrow for auction_id '{}' already exists", 
            auction_id
        );

        let attached_deposit = env::attached_deposit();
        assert!(
            attached_deposit.as_yoctonear() > 0,
            "Must attach deposit to fund escrow"
        );

        self.escrows.insert(&auction_id, &subaccount_id.parse().unwrap());
        self.escrows_by_type.insert(&auction_id, &"destination".to_string());

        let init_args = InitArgs {
            receiver_id,
            resolver_id,
            hashlock,
            timelocks,
            is_destination: true,
            partial_secrets: partial_secrets_vec,
        };

        let escrow_destination_wasm: &[u8] = include_bytes!("../../escrow_destination/res/escrow_destination.wasm");

        Promise::new(subaccount_id.parse().unwrap())
            .create_account()
            .transfer(attached_deposit)
            .deploy_contract(escrow_destination_wasm.to_vec())
            .function_call(
                "new".to_string(),
                serde_json::to_vec(&init_args).unwrap(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(50),
            )
    }

    /// Validate timelock sequence
    fn validate_timelock_sequence(&self, t: &Timelocks) {
        assert!(
            t.withdrawal < t.public_withdrawal,
            "Invalid timelock sequence: withdrawal >= public_withdrawal"
        );
        assert!(
            t.public_withdrawal < t.cancellation,
            "Invalid timelock sequence: public_withdrawal >= cancellation"
        );
        assert!(
            t.cancellation < t.public_cancellation,
            "Invalid timelock sequence: cancellation >= public_cancellation"
        );
    }

    /// Get escrow account for auction
    pub fn get_escrow_account(&self, auction_id: String) -> Option<AccountId> {
        self.escrows.get(&auction_id)
    }

    /// Get escrow type (source/destination)
    pub fn get_escrow_type(&self, auction_id: String) -> Option<String> {
        self.escrows_by_type.get(&auction_id)
    }

    /// Get all escrows (for admin/debugging)
    pub fn get_all_escrows(&self) -> Vec<EscrowInfo> {
        self.escrows.iter().map(|(auction_id, account_id)| {
            EscrowInfo {
                auction_id: auction_id.clone(),
                escrow_account: account_id.clone(),
                escrow_type: self.escrows_by_type.get(&auction_id).unwrap_or("unknown".to_string()),
                created_at: env::block_timestamp(),
            }
        }).collect()
    }

    /// Emergency cleanup (admin only)
    pub fn cleanup_escrow(&mut self, auction_id: String) {
        assert_eq!(env::predecessor_account_id(), self.admin, "Only admin can cleanup");
        self.escrows.remove(&auction_id);
        self.escrows_by_type.remove(&auction_id);
    }
}
