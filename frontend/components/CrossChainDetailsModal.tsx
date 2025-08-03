"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Eye, EyeOff, AlertTriangle, User, Shield } from "lucide-react";
import { useState } from "react";

interface CrossChainDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: CrossChainDetails) => void;
  fromToken: string;
  toToken: string;
}

interface CrossChainDetails {
  privateKey: string;
  receiverAddress: string;
  nearAccountId: string;
}

export const CrossChainDetailsModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  fromToken, 
  toToken 
}: CrossChainDetailsModalProps) => {
  const [privateKey, setPrivateKey] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [nearAccountId, setNearAccountId] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [useHardcodedAccount, setUseHardcodedAccount] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hardcoded account details (private key stored internally, never displayed)
  const HARDCODED_ACCOUNT = {
    address: "0xC15e658AC13a89E8D2E5adBBcf29D5d168554553",
    privateKey: "0x086d9b31deffa04692b629d84961c7281c8dac3f7be1742b3964ffc58a75c10e"
  };

  const isNearToEvm = fromToken === 'NEAR';
  const isEvmToNear = toToken === 'NEAR';

  const handleUseHardcodedAccount = () => {
    console.log('🎯 Test account selected');
    console.log('🏦 Using pre-configured test account');
    console.log('📝 Address:', HARDCODED_ACCOUNT.address);
    // Don't log the private key to console
    setUseHardcodedAccount(true);
    setShowManualEntry(false);
    // Store private key internally but don't display it
    setPrivateKey(HARDCODED_ACCOUNT.privateKey);
    if (isNearToEvm) {
      setReceiverAddress(HARDCODED_ACCOUNT.address);
    }
    setErrors({});
  };

  const handleManualEntry = () => {
    console.log('📝 Manual entry selected');
    setUseHardcodedAccount(false);
    setShowManualEntry(true);
    setPrivateKey("");
    setReceiverAddress("");
    setNearAccountId("");
    setErrors({});
    setShowPrivateKey(false);
  };

  const handleBackToOptions = () => {
    console.log('🔙 Back to account selection');
    setUseHardcodedAccount(false);
    setShowManualEntry(false);
    setPrivateKey("");
    setReceiverAddress("");
    setNearAccountId("");
    setErrors({});
    setShowPrivateKey(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate private key (even if hidden, we check it exists)
    if (!privateKey.trim()) {
      newErrors.privateKey = "Private key is required";
    } else if (privateKey.trim().length < 32) {
      newErrors.privateKey = "Private key appears to be invalid (too short)";
    }

    // Validate based on swap direction
    if (isNearToEvm) {
      // NEAR to EVM: Need receiver address on Polygon
      if (!receiverAddress.trim()) {
        newErrors.receiverAddress = "Receiver address on Polygon is required";
      } else if (!receiverAddress.startsWith('0x') || receiverAddress.length !== 42) {
        newErrors.receiverAddress = "Invalid Polygon address format";
      }
      
      if (!nearAccountId.trim()) {
        newErrors.nearAccountId = "NEAR account ID is required";
      } else if (!nearAccountId.includes('.')) {
        newErrors.nearAccountId = "NEAR account ID must include domain (e.g., account.testnet)";
      }
    } else if (isEvmToNear) {
      // EVM to NEAR: Need NEAR account address
      if (!nearAccountId.trim()) {
        newErrors.nearAccountId = "NEAR account address is required";
      } else if (!nearAccountId.includes('.')) {
        newErrors.nearAccountId = "NEAR account ID must include domain (e.g., account.testnet)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Create comprehensive payload object
      const payload = {
        swapDirection: isNearToEvm ? 'NEAR_TO_EVM' : 'EVM_TO_NEAR',
        fromToken,
        toToken,
        networkFee: '0.0',
        estimatedTime: '<30 seconds',
        accountType: useHardcodedAccount ? 'Test Account' : 'Manual Entry',
        receiverAddress: receiverAddress.trim(),
        nearAccountId: nearAccountId.trim(),
        timestamp: new Date().toISOString(),
        ...(useHardcodedAccount && { address: HARDCODED_ACCOUNT.address })
      };

      // Log details but hide private key for test account
      if (useHardcodedAccount) {
        console.log('✅ Form submitted with test account:', {
          accountType: 'Test Account',
          address: HARDCODED_ACCOUNT.address,
          privateKey: '***SECURED_TEST_ACCOUNT***', // Don't log actual key
          receiverAddress,
          nearAccountId
        });
        console.log('📦 Payload:', payload);
      } else {
        console.log('✅ Form submitted with manual details:', {
          accountType: 'Manual Entry',
          privateKeyLength: privateKey.length,
          receiverAddress,
          nearAccountId
        });
        console.log('📦 Payload:', payload);
      }
      
      onSubmit({
        privateKey: privateKey.trim(),
        receiverAddress: receiverAddress.trim(),
        nearAccountId: nearAccountId.trim()
      });
      
      // Reset form
      setPrivateKey("");
      setReceiverAddress("");
      setNearAccountId("");
      setErrors({});
      setShowPrivateKey(false);
      setUseHardcodedAccount(false);
      setShowManualEntry(false);
    }
  };

  const handleClose = () => {
    setPrivateKey("");
    setReceiverAddress("");
    setNearAccountId("");
    setErrors({});
    setShowPrivateKey(false);
    setUseHardcodedAccount(false);
    setShowManualEntry(false);
    onClose();
  };

  // Determine if we should show the form fields
  const showFormFields = useHardcodedAccount || showManualEntry;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-foreground text-lg">
              🌉 Cross-Chain Swap Details
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              {fromToken} → {toToken} cross-chain swap configuration
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Security Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-yellow-500 font-medium text-sm">Security Notice</h4>
                <p className="text-yellow-600 text-xs mt-1">
                  Never share your private key. This information is only used locally for the cross-chain swap.
                </p>
              </div>
            </div>
          </div>

          {/* Account Selection Options - Show only when no option is selected */}
          {!showFormFields && (
            <div className="space-y-3">
              <Label className="text-foreground font-medium">Choose Account Option</Label>
              
              {/* Hardcoded Account Option */}
              <Button
                variant="outline"
                className="w-full h-auto p-4 border-border bg-swap-input hover:bg-accent/50 justify-start"
                onClick={handleUseHardcodedAccount}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium text-foreground text-sm">Use Test Account</div>
                    <div className="text-xs text-muted-foreground">
                      0xC15e...4553 (Pre-configured for testing)
                    </div>
                  </div>
                  <div className="text-primary text-xs font-medium">
                    Select
                  </div>
                </div>
              </Button>

              {/* Manual Entry Option */}
              <Button
                variant="outline"
                className="w-full h-auto p-4 border-border bg-swap-input hover:bg-accent/50 justify-start"
                onClick={handleManualEntry}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium text-foreground text-sm">Enter Manual Details</div>
                    <div className="text-xs text-muted-foreground">
                      Use your own private key and addresses
                    </div>
                  </div>
                  <div className="text-primary text-xs font-medium">
                    Select
                  </div>
                </div>
              </Button>
            </div>
          )}

          {/* Show form fields when an option is selected */}
          {showFormFields && (
            <>
              {/* Back button and status indicator */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToOptions}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Back to options
                </Button>
                <div className={`border rounded px-2 py-1 ${
                  useHardcodedAccount 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                  <span className={`text-xs font-medium ${
                    useHardcodedAccount ? 'text-green-500' : 'text-blue-500'
                  }`}>
                    {useHardcodedAccount ? 'Test Account Selected' : 'Manual Entry Mode'}
                  </span>
                </div>
              </div>

              {/* Private Key Field - Only show for manual entry */}
              {!useHardcodedAccount && (
                <div className="space-y-2">
                  <Label htmlFor="privateKey" className="text-foreground font-medium">
                    Private Key <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="privateKey"
                      type={showPrivateKey ? "text" : "password"}
                      placeholder="Enter your private key (for both networks)"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      className={`bg-swap-input border-border pr-10 ${errors.privateKey ? 'border-red-500' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                    >
                      {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.privateKey && (
                    <p className="text-red-500 text-xs">{errors.privateKey}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    This private key will be used for signing transactions on both networks
                  </p>
                </div>
              )}

              {/* Test Account Security Notice - Only show for test account */}
              {useHardcodedAccount && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-green-500 font-medium text-sm">Test Account Active</h4>
                      <p className="text-green-600 text-xs mt-1">
                        Using pre-configured test account with secured credentials. Private key is handled internally for security.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Fields Based on Swap Direction */}
              {isNearToEvm && (
                <>
                  {/* Receiver Address on Polygon */}
                  <div className="space-y-2">
                    <Label htmlFor="receiverAddress" className="text-foreground font-medium">
                      Receiver Address (Polygon) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="receiverAddress"
                      type="text"
                      placeholder="0x... (Polygon address to receive tokens)"
                      value={receiverAddress}
                      onChange={(e) => setReceiverAddress(e.target.value)}
                      className={`bg-swap-input border-border ${errors.receiverAddress ? 'border-red-500' : ''}`}
                      readOnly={useHardcodedAccount}
                    />
                    {errors.receiverAddress && (
                      <p className="text-red-500 text-xs">{errors.receiverAddress}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {useHardcodedAccount
                        ? "Using pre-configured test account address"
                        : "Polygon address where you&apos;ll receive the swapped tokens"
                      }
                    </p>
                  </div>

                  {/* NEAR Account ID */}
                  <div className="space-y-2">
                    <Label htmlFor="nearAccountId" className="text-foreground font-medium">
                      NEAR Account ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nearAccountId"
                      type="text"
                      placeholder="your-account.testnet"
                      value={nearAccountId}
                      onChange={(e) => setNearAccountId(e.target.value)}
                      className={`bg-swap-input border-border ${errors.nearAccountId ? 'border-red-500' : ''}`}
                    />
                    {errors.nearAccountId && (
                      <p className="text-red-500 text-xs">{errors.nearAccountId}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Your NEAR account ID (e.g., account.testnet or account.near)
                    </p>
                  </div>
                </>
              )}

              {isEvmToNear && (
                <div className="space-y-2">
                  <Label htmlFor="nearAccountAddress" className="text-foreground font-medium">
                    NEAR Account Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nearAccountAddress"
                    type="text"
                    placeholder="your-account.testnet"
                    value={nearAccountId}
                    onChange={(e) => setNearAccountId(e.target.value)}
                    className={`bg-swap-input border-border ${errors.nearAccountId ? 'border-red-500' : ''}`}
                  />
                  {errors.nearAccountId && (
                    <p className="text-red-500 text-xs">{errors.nearAccountId}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    NEAR account where you&apos;ll receive the swapped tokens
                  </p>
                </div>
              )}

              {/* Swap Direction Info */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center space-x-2 text-blue-500 text-sm">
                  <span>🔄</span>
                  <span className="font-medium">
                    {isNearToEvm ? 'NEAR → Polygon (EVM)' : 'Polygon (EVM) → NEAR'}
                  </span>
                </div>
                <p className="text-blue-600 text-xs mt-1">
                  {isNearToEvm 
                    ? 'Swapping from NEAR Protocol to Polygon network'
                    : 'Swapping from Polygon network to NEAR Protocol'
                  }
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-border hover:bg-accent"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Continue Swap
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
