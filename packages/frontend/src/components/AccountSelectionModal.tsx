"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FaUserCircle, FaPlus, FaCopy, FaCheck } from "react-icons/fa";

interface Account {
    id: string;
    name: string;
    address: string;
    balance: string;
}

interface AccountSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccountSelect: (account: string) => void;
}

function AccountSelectionModal({ isOpen, onClose, onAccountSelect }: AccountSelectionModalProps) {
    const [accounts] = useState<Account[]>([
        {
            id: "1",
            name: "Main Account",
            address: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p",
            balance: "1,234.56 XLM"
        },
        {
            id: "2",
            name: "Test Account",
            address: "0x2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q",
            balance: "567.89 XLM"
        },
        {
            id: "3",
            name: "Development Account",
            address: "0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r",
            balance: "890.12 XLM"
        }
    ]);

    const [isImporting, setIsImporting] = useState(false);
    const [newAccountName, setNewAccountName] = useState("");
    const [newAccountKey, setNewAccountKey] = useState("");
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const handleAccountSelect = (account: Account) => {
        onAccountSelect(account.address);
        onClose();
    };

    const handleImportAccount = () => {
        setIsImporting(true);
        // Add import logic here
        setTimeout(() => {
            setIsImporting(false);
            setNewAccountName("");
            setNewAccountKey("");
        }, 1000);
    };

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 8)}...${address.slice(-4)}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg bg-ide-panel border-ide-border text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                        <FaUserCircle className="text-brand-soft" />
                        Select Account
                    </DialogTitle>
                    <DialogDescription className="text-ide-muted">
                        Choose an account to use for transactions
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Account List */}
                    <div className="space-y-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                onClick={() => handleAccountSelect(account)}
                                className="bg-ide-elevated p-4 rounded-md cursor-pointer hover:bg-ide-hover transition-colors border border-ide-border hover:border-brand"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-ide-subtle font-medium">{account.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-ide-muted text-sm font-mono">{formatAddress(account.address)}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyAddress(account.address);
                                                }}
                                                className="text-ide-muted hover:text-white transition-colors"
                                            >
                                                {copiedAddress === account.address ? (
                                                    <FaCheck size={12} className="text-green-500" />
                                                ) : (
                                                    <FaCopy size={12} />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-ide-muted text-xs mt-1">{account.balance}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Import New Account */}
                    <div className="border-t border-ide-border pt-4">
                        <h3 className="text-ide-subtle font-medium mb-3">Import Account</h3>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="accountName" className="text-ide-subtle text-sm">
                                    Account Name
                                </Label>
                                <Input
                                    id="accountName"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                    placeholder="Enter account name..."
                                    className="bg-ide-elevated border-ide-border text-white placeholder-ide-muted focus:border-brand mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="accountKey" className="text-ide-subtle text-sm">
                                    Private Key
                                </Label>
                                <Input
                                    id="accountKey"
                                    type="password"
                                    value={newAccountKey}
                                    onChange={(e) => setNewAccountKey(e.target.value)}
                                    placeholder="Enter private key..."
                                    className="bg-ide-elevated border-ide-border text-white placeholder-ide-muted focus:border-brand mt-1"
                                />
                            </div>

                            <Button
                                onClick={handleImportAccount}
                                disabled={!newAccountName || !newAccountKey || isImporting}
                                className="w-full bg-brand hover:bg-brand-hover text-white"
                            >
                                {isImporting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Importing...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <FaPlus size={14} />
                                        Import Account
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end pt-4 border-t border-ide-border">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-ide-border text-ide-subtle hover:bg-ide-hover"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default AccountSelectionModal;
