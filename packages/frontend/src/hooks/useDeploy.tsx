"use client";
import { useSelector } from "@xstate/store/react";
import { store } from "@/state";
import generateIdl from "@/lib/idl-wasm";
import { FunctionSpec } from "@/types/idl";
import useCompile from "./useCompile";
import ContractService from "@/lib/services/server/contract";
import { IParam } from "@/lib/services/types/common";
import { Network_Url } from "@/constants";
import { logger } from "@/state/utils";

// IDL cache to avoid regeneration for the same WASM
const idlCache = new Map<string, FunctionSpec[]>();

// Generate a hash for WASM buffer identification
function generateWasmHash(buffer: Buffer): string {
    const len = buffer.length;
    const first = buffer[0] || 0;
    const last = buffer[len - 1] || 0;
    const middle = buffer[Math.floor(len / 2)] || 0;
    return `${len}-${first}-${middle}-${last}`;
}

function useDeploy() {
    const { compileFile } = useCompile();
    
    const selected = useSelector(store, (state) => state.context.currentFile);
    const currWasm = useSelector(store, (state) => state.context.currentWasm);
    
    const deployWasm = async (wasmBuf: null | Buffer, ctorParamList: IParam[]) => {
        const startTime = performance.now();
        console.log('[tur] Starting deployment process');
        
        try {
            store.send({ type: "setDialogSpinner", show: true });
            
            // Step 1: Resolve WASM buffer
            let finalWasmBuf = wasmBuf;
            
            if (!finalWasmBuf) {
                // Check if current WASM matches selected file (exact match)
                if (selected && currWasm.path === selected) {
                    console.log('[tur] Using cached WASM from state');
                    finalWasmBuf = currWasm.buff;
                } else if (selected && selected !== 'explorer') {
                    console.log('[tur] Compiling file...');
                    const compileStart = performance.now();
                    const r = await compileFile();
                    console.log(`[tur] Compilation took ${performance.now() - compileStart}ms`);
                    finalWasmBuf = r.data;
                }
            }
            
            if (!finalWasmBuf) {
                logger.error('No WASM buffer available for deployment');
                return false;
            }
            
            // Step 2: Initialize contract service
            const contractService = new ContractService(Network_Url.TEST_NET);
            const wasmHash = generateWasmHash(finalWasmBuf);
            
            // Step 3: Deploy contract and generate IDL in parallel
            console.log('[tur] Starting parallel deployment and IDL generation');
            const parallelStart = performance.now();
            
            const [contractAddress, idl] = await Promise.all([
                (async () => {
                    const deployStart = performance.now();
                    const addr = await contractService.deployContract(finalWasmBuf!, ctorParamList);
                    console.log(`[tur] Contract deployment took ${performance.now() - deployStart}ms`);
                    return addr;
                })(),
                (async () => {
                    // Check cache first
                    if (idlCache.has(wasmHash)) {
                        console.log('[tur] Using cached IDL');
                        return idlCache.get(wasmHash)!;
                    }
                    
                    // Generate new IDL
                    const idlStart = performance.now();
                    const generatedIdl = await generateIdl(finalWasmBuf!);
                    console.log(`[tur] IDL generation took ${performance.now() - idlStart}ms`);
                    
                    // Cache the result (with size limit)
                    if (idlCache.size >= 10) {
                        const firstKey = idlCache.keys().next().value;
                        if (firstKey) {
                            idlCache.delete(firstKey);
                        }
                    }
                    idlCache.set(wasmHash, generatedIdl);
                    
                    return generatedIdl;
                })()
            ]);
            
            console.log(`[tur] Parallel operations took ${performance.now() - parallelStart}ms`);
            console.log('[tur] Contract deployed successfully!', contractAddress);
            
            // Step 4: Update store with results
            if (contractAddress) {
                const filteredIdl = idl.filter((i: FunctionSpec) => 
                    !i.name.includes('constructor')
                );
                
                store.send({ 
                    type: "updateContract", 
                    methods: filteredIdl,
                    address: contractAddress 
                });
            }
            
            console.log(`[tur] Total deployment process took ${performance.now() - startTime}ms`);
            return true;
            
        } catch (e) {
            logger.error('Deployment failed');
            console.error('[tur] Deployment error:', e);
            return false;
        } finally {
            store.send({ type: "setDialogSpinner", show: false });
        }
    };
    
    return {
        deployWasm
    };
}

export default useDeploy;





// "use client";

// import { useSelector } from "@xstate/store/react";
// import { store } from "@/state";
// import generateIdl from "@/lib/idl-wasm";
// import { FunctionSpec } from "@/types/idl";
// import useCompile from "./useCompile";
// import ContractService from "@/lib/services/server/contract";
// import { IParam } from "@/lib/services/types/common";
// import { Network_Url } from "@/constants";
// import { logger } from "@/state/utils";


// function useDeploy() {
//     const {compileFile} = useCompile();
    
//     const selected = useSelector(store, (state) => state.context.currentFile);
//     const currWasm = useSelector(store, (state) => state.context.currentWasm);


//     const deployWasm = async (wasmBuf: null | Buffer, ctorParamList: IParam[]) => {
//         console.log('[tur] deploying', wasmBuf)
        
//         if(currWasm.path.indexOf(selected || '') > -1) {
//             wasmBuf = currWasm.buff
//         } else if(!wasmBuf && selected && selected !== 'explorer') {
//             const r = await compileFile();
//             wasmBuf = r.data
//         }
        
//         if (!wasmBuf) {
//             return;
//         }
//         try {
//             store.send({ type: "setDialogSpinner", show: true });
//             const contractService = new ContractService(Network_Url.TEST_NET)
        
//             const idl = await generateIdl(wasmBuf);
//             const fltrd = idl.filter((i: FunctionSpec) => i.name.indexOf('constructor') == -1);
//             store.send({ type: "updateContract", methods: fltrd });
//             const contractAddress = await contractService.deployContract(wasmBuf, ctorParamList);
//             console.log("Contract deployed successfully!", contractAddress);
//             if(contractAddress) store.send({ type: "updateContract", address: contractAddress });

//         } catch (e) {
//             logger.error('Deployment failed')
//             console.log('deployment error', e)
//             return !1
//         } finally {
//             store.send({ type: "setDialogSpinner", show: false });
//         }
//         return !0
//     }

//     return {
//         deployWasm
//     }
// }

// export default useDeploy;