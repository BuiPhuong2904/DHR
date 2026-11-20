"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ZeroHash, id, type JsonRpcSigner } from "ethers";
import { connectWallet, getContracts } from "@/lib/web3";

export type Roles = { isAdmin: boolean; isHospital: boolean; isDoctor: boolean; isVerifier: boolean };
const NO_ROLES: Roles = { isAdmin: false, isHospital: false, isDoctor: false, isVerifier: false };

interface WalletContextType {
  address: string | null;
  signer: JsonRpcSigner | null;
  roles: Roles;
  connecting: boolean;
  error: string | null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect: (_unused?: string) => Promise<void>;
  disconnect: () => void;
  refreshRoles: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  signer: null,
  roles: NO_ROLES,
  connecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  refreshRoles: async () => {},
});

async function readRoles(signer: JsonRpcSigner, address: string): Promise<Roles> {
  const { record } = getContracts(signer);
  const [isAdmin, isHospital, isDoctor, isVerifier] = await Promise.all([
    record.hasRole(ZeroHash, address), // DEFAULT_ADMIN_ROLE = 0x00...00
    record.hasRole(id("HOSPITAL_ROLE"), address),
    record.hasRole(id("DOCTOR_ROLE"), address),
    record.hasRole(id("VERIFIER_ROLE"), address),
  ]);
  return { isAdmin, isHospital, isDoctor, isVerifier };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [roles, setRoles] = useState<Roles>(NO_ROLES);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const { signer, address } = await connectWallet();
      setSigner(signer);
      setAddress(address);
      setRoles(await readRoles(signer, address));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSigner(null);
    setAddress(null);
    setRoles(NO_ROLES);
  }, []);

  const refreshRoles = useCallback(async () => {
    if (signer && address) setRoles(await readRoles(signer, address));
  }, [signer, address]);

  // Đổi tài khoản trong MetaMask -> kết nối lại; đổi mạng -> tải lại trang
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = typeof window !== "undefined" ? (window.ethereum as any) : undefined;
    if (!eth?.on) return;
    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else if (address) void connect();
    };
    const onChain = () => window.location.reload();
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [address, connect, disconnect]);

  return (
    <WalletContext.Provider value={{ address, signer, roles, connecting, error, connect, disconnect, refreshRoles }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
