export const Network_Url = {
    BACKEND_SERVER: 'http://localhost:4444',
    LOCAL: 'http://localhost:8000/rpc',
    PUBLIC: 'https://soroban.stellar.org:443',
    TEST_NET: 'https://rpc-testnet.stellar.org',
    FUTURE_NET: 'https://horizon-futurenet.stellar.org:443',
}

export const DefaultTimeout = 10000;

export const DefaultFetchCallback = async (response: any) => response.json();
