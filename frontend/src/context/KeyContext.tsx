"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
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
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);

  const setSessionKey = useCallback((key: CryptoKey) => setPrivateKey(key), []);

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
  }, []);

  const clear = useCallback(() => setPrivateKey(null), []);

  return (
    <KeyContext.Provider value={{ privateKey, setSessionKey, loadFromBackup, clear }}>{children}</KeyContext.Provider>
  );
}

export const useKeys = () => useContext(KeyContext);
