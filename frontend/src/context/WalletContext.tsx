"use client";

import React, { createContext, useContext, useState } from "react";
import { MOCK_WALLETS } from "@/mock/dhrData";

interface WalletContextType {
  address: string | null;
  connect: (customAddress?: string) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connect: () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(MOCK_WALLETS.patient);

  const connect = (customAddress?: string) => {
    setAddress(customAddress || MOCK_WALLETS.patient);
  };

  const disconnect = () => {
    setAddress(null);
  };

  return (
    <WalletContext.Provider value={{ address, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);