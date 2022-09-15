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
                authorizedPubkey: wallet.publicKey
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

        // let tx = new Transaction().add(
        //     // create nonce account
        //     SystemProgram.createAccount({
        //       fromPubkey: wallet.publicKey,
        //       newAccountPubkey: nonceAccount.publicKey,
        //       lamports: await connection.getMinimumBalanceForRentExemption(
        //         NONCE_ACCOUNT_LENGTH
        //       ),
        //       space: NONCE_ACCOUNT_LENGTH,
        //       programId: SystemProgram.programId,
        //     }),
        //     // init nonce account
        //     SystemProgram.nonceInitialize({
        //       noncePubkey: nonceAccount.publicKey, // nonce account pubkey
        //       authorizedPubkey: wallet.publicKey, // nonce account authority (for advance and close)
        //     })
        // );

        // const signature = await wallet.sendTransaction(tx, connection,  {  signers: [nonceAccount] })
        // console.log('nonce account initialized: ', signature)

        // const nonceAccountRentFreeBalance = await connection.getMinimumBalanceForRentExemption(NonceAccountSize)
        
        // const latestBlockhash = await connection.getLatestBlockhash();
        // console.log('before sending tx')

        // const transaction = new Transaction({...latestBlockhash, feePayer: wallet.publicKey}).add(
        //     SystemProgram.createNonceAccount({
        //         authorizedPubkey: wallet.publicKey,
        //         fromPubkey: wallet.publicKey,
        //         lamports: nonceAccountRentFreeBalance,
        //         noncePubkey: nonceAccount.publicKey
        //      }),
        //      SystemProgram.nonceInitialize({
        //         noncePubkey: nonceAccount.publicKey,
        //         authorizedPubkey: wallet.publicKey
        //      })
        // );

        // transaction.partialSign(nonceAccount)
        // const a = String.fromCharCode.apply(null, transaction.serialize({requireAllSignatures: false}) as any)
        // console.log("~~~~", btoa(a) )

        // const signature = await wallet.sendTransaction(transaction, connection, {  signers: [nonceAccount], skipPreflight: true });
        // console.log('after sending tx: ', signature)
        // // await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
        // console.log("transaction confirmed")
        // return nonceAccount
    }

    const createDurableTx = async (wallet: WalletContextState, connection: Connection, to: PublicKey, amount: number) => {
        if (!wallet || !wallet.publicKey) throw new WalletNotConnectedError();

        const nonceAccountKeypair  = await createAndInitializeNonceAccount(wallet, connection);

        const accountInfo = await connection.getAccountInfo(nonceAccountKeypair.publicKey);
        console.log('accountInfo: ', accountInfo)
        const nonceAccount = accountInfo && NonceAccount.fromAccountData(accountInfo.data);
        console.log('nonceAccount: ', nonceAccount)

        let tx = new Transaction().add(
            // nonce advance must be the first insturction
            SystemProgram.nonceAdvance({
              noncePubkey: nonceAccountKeypair.publicKey,
              authorizedPubkey: wallet.publicKey,
            }),
            // after that, you do what you really want to do, here we append a transfer instruction as an example.
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: destAddress,
              lamports: amount,
            })
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
        console.log('durable tx buffer: ', Buffer.from(JSON.stringify(tx)));
        setDurableTxBuffer(Buffer.from(JSON.stringify(tx)));
    }

    const sendRawTx = async (connection: Connection, durableTx: Transaction | null | undefined) => {
        if (!durableTx) throw new Error("no Durable Tx");
       
        const signature =  await connection.sendRawTransaction(durableTx.serialize())
        console.log('Raw transaction sent: ', signature)
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
                onClick={() => sendRawTx(connection, durableTx)}
            >
                <span>Send the raw durable tx</span>
            </button>      
        </main>
    )
}

export default HomeView
