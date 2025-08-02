use near_workspaces::{types::NearToken, Account, Contract, Worker};
use serde_json::json;
use std::collections::HashMap;

#[tokio::test]
async fn test_cross_chain_swap_flow() -> Result<(), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;
    
    // Create test accounts
    let factory_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;
    
    // Deploy factory contract
    let factory_wasm = include_bytes!("../escrow_factory/res/escrow_factory.wasm");
    let factory_contract = factory_account
        .deploy(&factory_wasm)
        .await?
        .into_result()?;

    // Initialize factory
    factory_contract
        .call("new")
        .max_gas()
        .transact()
        .await?;

    // Test parameters
    let auction_id = "test_auction_123";
    let secret = "my_secret_key_12345678901234567890"; // 32 chars
    let secret_hash = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(secret.as_bytes()));
    
    let now = worker.view_block().await?.timestamp();
    let timelocks = json!({
        "withdrawal": now + 300_000_000_000u64, // 5 minutes
        "public_withdrawal": now + 600_000_000_000u64, // 10 minutes  
        "cancellation": now + 900_000_000_000u64, // 15 minutes
        "public_cancellation": now + 1200_000_000_000u64 // 20 minutes
    });

    println!("✅ Phase 1: Creating source escrow (user locks funds on source chain)");
    
    // Create source escrow (user locks 5 NEAR)
    let source_result = factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": auction_id,
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": secret_hash,
            "timelocks": timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?;

    assert!(source_result.is_success(), "Source escrow creation failed");
    
    // Get source escrow account
    let source_escrow_id: Option<String> = factory_contract
        .view("get_escrow_account")
        .args_json(json!({"auction_id": auction_id}))
        .await?
        .json()?;
    
    let source_escrow_account = source_escrow_id.unwrap();
    println!("Source escrow created: {}", source_escrow_account);

    println!("✅ Phase 2: Creating destination escrow (resolver provides liquidity)");
    
    // Create destination escrow (resolver locks 5 NEAR on destination)
    let dest_result = factory_contract
        .call("create_destination_escrow")
        .args_json(json!({
            "auction_id": format!("{}_dest", auction_id),
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(), 
            "hashlock": secret_hash,
            "timelocks": timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?;

    assert!(dest_result.is_success(), "Destination escrow creation failed");

    let dest_escrow_id: Option<String> = factory_contract
        .view("get_escrow_account")
        .args_json(json!({"auction_id": format!("{}_dest", auction_id)}))
        .await?
        .json()?;
    
    let dest_escrow_account = dest_escrow_id.unwrap();
    println!("Destination escrow created: {}", dest_escrow_account);

    // Check initial states
    let source_state: serde_json::Value = worker
        .view(&source_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    let dest_state: serde_json::Value = worker
        .view(&dest_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    assert_eq!(source_state["status"], "Funded");
    assert_eq!(dest_state["status"], "Funded");
    println!("✅ Both escrows are funded and ready");

    println!("✅ Phase 3: User claims from destination (reveals secret)");
    
    // User claims from destination escrow
    let claim_dest_result = user_account
        .call(&dest_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(secret)}))
        .max_gas()
        .transact()
        .await?;

    assert!(claim_dest_result.is_success(), "Destination claim failed");
    println!("User successfully claimed from destination escrow");

    // Check destination state after claim
    let dest_state_after: serde_json::Value = worker
        .view(&dest_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    assert_eq!(dest_state_after["status"], "Claimed");
    assert_eq!(dest_state_after["filled_amount"], "5000000000000000000000000");

    println!("✅ Phase 4: Resolver claims from source (gets reimbursed)");
    
    // Resolver claims from source escrow using the revealed secret
    let claim_source_result = resolver_account
        .call(&source_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(secret)}))
        .max_gas()
        .transact()
        .await?;

    assert!(claim_source_result.is_success(), "Source claim failed");
    println!("Resolver successfully claimed from source escrow");

    // Check final states
    let source_state_final: serde_json::Value = worker
        .view(&source_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    assert_eq!(source_state_final["status"], "Claimed");
    assert_eq!(source_state_final["filled_amount"], "5000000000000000000000000");

    println!("✅ Cross-chain swap completed successfully!");
    println!("- User locked 5 NEAR on source chain");
    println!("- Resolver provided 5 NEAR liquidity on destination chain");
    println!("- User claimed 5 NEAR on destination chain");
    println!("- Resolver got reimbursed 5 NEAR from source chain");

    Ok(())
}

#[tokio::test]
async fn test_refund_scenarios() -> Result<(), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;
    
    let factory_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;
    
    // Deploy factory
    let factory_wasm = include_bytes!("../escrow_factory/res/escrow_factory.wasm");
    let factory_contract = factory_account
        .deploy(&factory_wasm)
        .await?
        .into_result()?;

    factory_contract.call("new").max_gas().transact().await?;

    let auction_id = "refund_test";
    let secret = "refund_secret_1234567890123456789012";
    let secret_hash = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(secret.as_bytes()));
    
    let now = worker.view_block().await?.timestamp();
    let timelocks = json!({
        "withdrawal": now + 100_000_000_000u64, // 100ms (very short for testing)
        "public_withdrawal": now + 200_000_000_000u64,
        "cancellation": now + 300_000_000_000u64, 
        "public_cancellation": now + 400_000_000_000u64
    });

    println!("🔄 Testing refund scenario - timeout expiry");

    // Create source escrow
    factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": auction_id,
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": secret_hash,
            "timelocks": timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(3))
        .max_gas()
        .transact()
        .await?;

    let source_escrow_id: Option<String> = factory_contract
        .view("get_escrow_account")
        .args_json(json!({"auction_id": auction_id}))
        .await?
        .json()?;
    
    let source_escrow_account = source_escrow_id.unwrap();

    // Wait for cancellation period to pass
    println!("Waiting for cancellation period...");
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Try to refund
    let refund_result = resolver_account
        .call(&source_escrow_account.parse()?, "refund")
        .max_gas()
        .transact()
        .await?;

    assert!(refund_result.is_success(), "Refund should succeed after timeout");

    let final_state: serde_json::Value = worker
        .view(&source_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    assert_eq!(final_state["status"], "Refunded");
    println!("✅ Refund completed successfully after timeout");

    Ok(())
}

#[tokio::test]  
async fn test_partial_secrets() -> Result<(), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;
    
    let factory_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;
    
    // Deploy factory
    let factory_wasm = include_bytes!("../escrow_factory/res/escrow_factory.wasm");
    let factory_contract = factory_account
        .deploy(&factory_wasm)
        .await?
        .into_result()?;

    factory_contract.call("new").max_gas().transact().await?;

    println!("🔄 Testing partial secrets functionality");

    let auction_id = "partial_test";
    let main_secret = "main_secret_12345678901234567890123";
    let partial_secret1 = "partial1_12345678901234567890123";
    let partial_secret2 = "partial2_12345678901234567890123";
    
    let main_hash = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(main_secret.as_bytes()));
    let partial_hash1 = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(partial_secret1.as_bytes()));
    let partial_hash2 = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(partial_secret2.as_bytes()));
    
    let now = worker.view_block().await?.timestamp();
    let timelocks = json!({
        "withdrawal": now + 300_000_000_000u64,
        "public_withdrawal": now + 600_000_000_000u64,  
        "cancellation": now + 900_000_000_000u64,
        "public_cancellation": now + 1200_000_000_000u64
    });

    // Create escrow with partial secrets
    factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": auction_id,
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": main_hash,
            "timelocks": timelocks,
            "partial_secrets": [partial_hash1, partial_hash2]
        }))
        .deposit(NearToken::from_near(4))
        .max_gas()
        .transact()
        .await?;

    let source_escrow_id: Option<String> = factory_contract
        .view("get_escrow_account")
        .args_json(json!({"auction_id": auction_id}))
        .await?
        .json()?;
    
    let source_escrow_account = source_escrow_id.unwrap();

    // Claim with first partial secret
    println!("Claiming with first partial secret...");
    let claim1_result = resolver_account
        .call(&source_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(partial_secret1)}))
        .max_gas()
        .transact()
        .await?;

    assert!(claim1_result.is_success(), "First partial claim failed");

    let state1: serde_json::Value = worker
        .view(&source_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    // Should be partially filled (2 NEAR out of 4)
    assert_eq!(state1["filled_amount"], "2000000000000000000000000");
    assert_eq!(state1["status"], "Funded"); // Still funded, not fully claimed

    // Claim with second partial secret
    println!("Claiming with second partial secret...");
    let claim2_result = resolver_account
        .call(&source_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(partial_secret2)}))
        .max_gas()
        .transact()
        .await?;

    assert!(claim2_result.is_success(), "Second partial claim failed");

    let state2: serde_json::Value = worker
        .view(&source_escrow_account.parse()?, "get_state")
        .await?
        .json()?;
    
    // Should be fully filled (4 NEAR)
    assert_eq!(state2["filled_amount"], "4000000000000000000000000");
    assert_eq!(state2["status"], "Claimed"); // Now fully claimed

    println!("✅ Partial secrets test completed successfully!");

    Ok(())
}

#[tokio::test]
async fn test_error_conditions() -> Result<(), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;
    
    let factory_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;
    let unauthorized_account = worker.dev_create_account().await?;
    
    // Deploy factory
    let factory_wasm = include_bytes!("../escrow_factory/res/escrow_factory.wasm");
    let factory_contract = factory_account
        .deploy(&factory_wasm)
        .await?
        .into_result()?;

    factory_contract.call("new").max_gas().transact().await?;

    println!("🔄 Testing error conditions and security");

    let auction_id = "error_test";
    let secret = "error_secret_123456789012345678901";
    let wrong_secret = "wrong_secret_123456789012345678901";
    let secret_hash = hex::encode(near_workspaces::types::CryptoHash::hash_bytes(secret.as_bytes()));
    
    let now = worker.view_block().await?.timestamp();
    let timelocks = json!({
        "withdrawal": now + 300_000_000_000u64,
        "public_withdrawal": now + 600_000_000_000u64,
        "cancellation": now + 900_000_000_000u64,
        "public_cancellation": now + 1200_000_000_000u64
    });

    // Create source escrow
    factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": auction_id,
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": secret_hash,
            "timelocks": timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(2))
        .max_gas()
        .transact()
        .await?;

    let source_escrow_id: Option<String> = factory_contract
        .view("get_escrow_account")
        .args_json(json!({"auction_id": auction_id}))
        .await?
        .json()?;
    
    let source_escrow_account = source_escrow_id.unwrap();

    println!("Testing unauthorized claim attempt...");
    // Try to claim with unauthorized account
    let unauthorized_claim = unauthorized_account
        .call(&source_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(secret)}))
        .max_gas()
        .transact()
        .await?;

    assert!(unauthorized_claim.is_failure(), "Unauthorized claim should fail");

    println!("Testing wrong secret...");
    // Try to claim with wrong secret
    let wrong_secret_claim = resolver_account
        .call(&source_escrow_account.parse()?, "claim")
        .args_json(json!({"secret": hex::encode(wrong_secret)}))
        .max_gas()
        .transact()
        .await?;

    assert!(wrong_secret_claim.is_failure(), "Wrong secret claim should fail");

    println!("Testing duplicate auction ID...");
    // Try to create duplicate escrow
    let duplicate_result = factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": auction_id, // Same ID
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": secret_hash,
            "timelocks": timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(2))
        .max_gas()
        .transact()
        .await?;

    assert!(duplicate_result.is_failure(), "Duplicate auction ID should fail");

    println!("Testing invalid timelock sequence...");
    // Try invalid timelock sequence  
    let invalid_timelocks = json!({
        "withdrawal": now + 600_000_000_000u64, // Wrong order
        "public_withdrawal": now + 300_000_000_000u64,
        "cancellation": now + 900_000_000_000u64,
        "public_cancellation": now + 1200_000_000_000u64
    });

    let invalid_timelock_result = factory_contract
        .call("create_source_escrow")
        .args_json(json!({
            "auction_id": "invalid_timelock_test",
            "receiver_id": user_account.id(),
            "resolver_id": resolver_account.id(),
            "hashlock": secret_hash,
            "timelocks": invalid_timelocks,
            "partial_secrets": null
        }))
        .deposit(NearToken::from_near(2))
        .max_gas()
        .transact()
        .await?;

    assert!(invalid_timelock_result.is_failure(), "Invalid timelock sequence should fail");

    println!("✅ All error condition tests passed!");

    Ok(())
}