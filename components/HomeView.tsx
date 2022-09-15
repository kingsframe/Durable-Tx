import styles from '../styles/Home.module.css'
import React, { useEffect, useState } from 'react';
import { useWallet, useConnection, WalletContextState } from '@solana/wallet-adapter-react';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getUserSOLBalance, transfer } from '../utils/helpers';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { sign } from 'crypto';

const destAddress = new PublicKey('2oaH7AKTzzT2LrXKhAzqeXFPvSTpj2hrksXXGg5dSXFz')
const transferAmount = 0.1 * LAMPORTS_PER_SOL;
const NonceAccountSize = 80;


const HomeView = () => {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState(0)
    const [durableTx, setDurableTx] = useState<Transaction | null>()

    useEffect(()=>{
        if (wallet.publicKey){
            getUserSOLBalance(wallet.publicKey, connection).then(walletBalance => setBalance(walletBalance));
        }
    },[wallet, connection])

    const createAndInitializeNonceAccount = async (wallet: WalletContextState, connection: Connection) => {
        if (!wallet.publicKey) throw new WalletNotConnectedError();
        const nonceAccount = Keypair.generate();
        const nonceAccountRentFreeBalance = await connection.getMinimumBalanceForRentExemption(NonceAccountSize)
        
        const latestBlockhash = await connection.getLatestBlockhash();
        console.log('before sending tx')

        const transaction = new Transaction({...latestBlockhash, feePayer: wallet.publicKey}).add(
            SystemProgram.createNonceAccount({
                authorizedPubkey: wallet.publicKey,
                fromPubkey: wallet.publicKey,
                lamports: nonceAccountRentFreeBalance,
                noncePubkey: nonceAccount.publicKey
             }),
             SystemProgram.nonceInitialize({
                noncePubkey: nonceAccount.publicKey,
                authorizedPubkey: wallet.publicKey
             })
        );

        transaction.partialSign(nonceAccount)
        const a = String.fromCharCode.apply(null, transaction.serialize({requireAllSignatures: false}) as any)
        console.log("~~~~", btoa(a) )

        const signature = await wallet.sendTransaction(transaction, connection, {  signers: [nonceAccount], skipPreflight: true });
        console.log('after sending tx: ', signature)
        // await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
        console.log("transaction confirmed")
        return nonceAccount
    }

    const createDurableTx = async (wallet: WalletContextState, connection: Connection, to: PublicKey, amount: number) => {
        if (!wallet.publicKey) throw new WalletNotConnectedError();

        const nonceAccount = await createAndInitializeNonceAccount(wallet, connection);
        const na = await connection.getNonce();
        na.
        const transaction = new Transaction({nonceInfo: {
            nonce: ...,
            nonceInstruction: SystemProgram.nonceAdvance({noncePubkey: nonceAccount.publicKey, authorizedPubkey: wallet.publicKey}),
        }}).add(
            
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: to,
                lamports: amount,
              })
          );

        const signedTransaction = wallet.signTransaction && await wallet.signTransaction(transaction)

        setDurableTx(signedTransaction)
    }

    return (
        <main className={styles.main}>
            <h1 className={styles.title}>
                SOL Balance : {balance} 
            </h1>
            <button
                onClick={() => transfer(wallet, connection, destAddress, transferAmount)}
            >
                <span>Transfer</span>
            </button>
            <button
                onClick={() => createDurableTx(wallet, connection, destAddress, transferAmount)}
            >
                <span>Create a durable tx</span>
            </button>
            <p>{durableTx ? JSON.stringify(durableTx): 'No Tx yet'}</p>
        </main>
    )
}

export default HomeView
