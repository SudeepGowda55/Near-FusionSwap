"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  showCloseButton?: boolean;
}

export const TransactionModal = ({ 
  isOpen, 
  onClose, 
  title, 
  description,
  showCloseButton = true 
}: TransactionModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border max-w-md mx-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative p-8 text-center">
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          {/* Transaction Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-primary-foreground">
                  <path d="M9 16L14 21L23 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-lg transform rotate-45 flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-600 rounded transform -rotate-45"></div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            {title}
          </h2>
          
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};