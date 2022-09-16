import styles from '../styles/Home.module.css'
import React, { useEffect, useState } from 'react';
import { useWallet, useConnection, WalletContextState } from '@solana/wallet-adapter-react';
import { Connection, Keypair, LAMPORTS_PER_SOL, NonceAccount, NONCE_ACCOUNT_LENGTH, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getUserSOLBalance, transfer } from '../utils/helpers';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';

const destAddress = new PublicKey('2oaH7AKTzzT2LrXKhAzqeXFPvSTpj2hrksXXGg5dSXFz')
const transferAmount = 0.1 * LAMPORTS_PER_SOL;

const HomeView = () => {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState(0)
    const [durableTx, setDurableTx] = useState<Transaction | null>()
    const [durableTxBuffer, setDurableTxBuffer] = useState<Buffer | null>()

    useEffect(()=>{
        if (wallet.publicKey){
            getUserSOLBalance(wallet.publicKey, connection).then(walletBalance => setBalance(walletBalance));
        }
    },[wallet, connection])

    const createAndInitializeNonceAccount = async (wallet: WalletContextState, connection: Connection) => {
        if (!wallet.publicKey) throw new WalletNotConnectedError();
        const nonceAccount = Keypair.generate();
        const nonceAccountRentFreeBalance = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH)

        const tx = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: wallet.publicKey,
                newAccountPubkey: nonceAccount.publicKey,
                lamports: nonceAccountRentFreeBalance,
                space: NONCE_ACCOUNT_LENGTH,
                programId: SystemProgram.programId
             }),
             SystemProgram.nonceInitialize({
                noncePubkey: nonceAccount.publicKey,
                authorizedPubkey: wallet.publicKey // TODO determine correct nonce authority
             })
        );

        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight }
        } = await connection.getLatestBlockhashAndContext();

        const signature = await wallet.sendTransaction(tx, connection, { signers: [nonceAccount] })
        await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
        console.log('nonce account initialized: ', signature)
        return nonceAccount
    }

    const createDurableTx = async (wallet: WalletContextState, connection: Connection, to: PublicKey, amount: number) => {
        if (!wallet || !wallet.publicKey) throw new WalletNotConnectedError();

        const nonceAccountKeypair  = await createAndInitializeNonceAccount(wallet, connection);

        const accountInfo = await connection.getAccountInfo(nonceAccountKeypair.publicKey);
        const nonceAccount = accountInfo && NonceAccount.fromAccountData(accountInfo.data);
        console.log('nonceAccount: ', nonceAccount)

        let tx = new Transaction().add(
            // nonce advance must be the first insturction
            SystemProgram.nonceAdvance({
              noncePubkey: nonceAccountKeypair.publicKey,
              authorizedPubkey: wallet.publicKey,
            }),
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: destAddress,
              lamports: amount,
            }),
            // SystemProgram.nonceWithdraw({
            //     authorizedPubkey: wallet.publicKey,
            //     lamports: accountInfo!.lamports,
            //     noncePubkey: nonceAccountKeypair.publicKey,
            //     toPubkey: wallet.publicKey,
            // }),
        );

        // assign `nonce` as recentBlockhash
        if (nonceAccount && nonceAccount.nonce){
            tx.recentBlockhash = nonceAccount.nonce
        } else {
            return "nonce not found";
        }   
        
        tx.feePayer = wallet.publicKey;
        tx.sign(
            nonceAccountKeypair
        ); /* fee payer + nonce account authority + ... */
        tx  = await wallet.signTransaction!(tx);

        setDurableTx(tx);
        setDurableTxBuffer(tx.serialize());
    }

    const sendRawTx = async (connection: Connection, durableTx: Buffer | null | undefined) => {
        if (!durableTx) throw new Error("no Durable Tx");
       
        const signature =  await connection.sendRawTransaction(durableTx)
        console.log('Raw transaction sent: ', signature)

        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight }
        } = await connection.getLatestBlockhashAndContext();
        await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
        console.log("durable transaction confirmed and sent")
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
            
            <button
                onClick={() => sendRawTx(connection, durableTxBuffer)}
            >
                <span>Send the raw durable tx</span>
            </button>      
        </main>
    )
}

export default HomeView
