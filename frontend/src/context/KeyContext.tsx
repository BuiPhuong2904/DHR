"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { restorePrivateKey, type KeyBackup } from "@/lib/crypto";

interface KeyContextType {
  privateKey: CryptoKey | null;
  setSessionKey: (key: CryptoKey) => void;
  loadFromBackup: (file: File, password: string) => Promise<void>;
  clear: () => void;
}

const KeyContext = createContext<KeyContextType>({
  privateKey: null,
  setSessionKey: () => {},
  loadFromBackup: async () => {},
  clear: () => {},
});

export function KeyProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [session, setSession] = useState<{ key: CryptoKey; owner: string } | null>(null);
  const privateKey = session && address && session.owner === address.toLowerCase() ? session.key : null;
  const setPrivateKey = useCallback(
    (key: CryptoKey | null) => setSession(key && address ? { key, owner: address.toLowerCase() } : null),
    [address],
  );

  const setSessionKey = useCallback((key: CryptoKey) => setPrivateKey(key), [setPrivateKey]);

  const loadFromBackup = useCallback(async (file: File, password: string) => {
    let backup: KeyBackup;
    try {
      backup = JSON.parse(await file.text()) as KeyBackup;
    } catch {
      throw new Error("File sao lưu không đúng định dạng.");
    }
    try {
      setPrivateKey(await restorePrivateKey(backup, password));
    } catch {
      throw new Error("Sai mật khẩu hoặc file sao lưu bị hỏng.");
    }
  }, [setPrivateKey]);

  const clear = useCallback(() => setSession(null), []);

  return (
    <KeyContext.Provider value={{ privateKey, setSessionKey, loadFromBackup, clear }}>{children}</KeyContext.Provider>
  );
}

export const useKeys = () => useContext(KeyContext);
