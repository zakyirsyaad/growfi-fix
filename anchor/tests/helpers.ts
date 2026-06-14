import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export function provider() {
  return anchor.AnchorProvider.env();
}

export function randomId() {
  return new anchor.BN(Date.now() + Math.floor(Math.random() * 100_000));
}

export function sha32(label: string) {
  return Array.from(Buffer.from(label.padEnd(32, "_").slice(0, 32)));
}

export function keypair() {
  return Keypair.generate();
}

export async function airdrop(connection: anchor.web3.Connection, publicKey: PublicKey) {
  const sig = await connection.requestAirdrop(publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}
