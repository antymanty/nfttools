const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const { max } = require('lodash');

async function main() {
  // Set up the provider
  const provider = new ethers.providers.JsonRpcProvider(
    "https://..." // Add RPC link
  );

  // Set up the contract instance
  const contractAddress = "0x......"; // Add address here
  const erc721ABI = [
    // Add the necessary ERC721 ABI components here
    // You can find the ABI on Etherscan or generate it from the contract source code
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "tokenURI",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "maxSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ];
  const contract = new ethers.Contract(contractAddress, erc721ABI, provider);

// Retrieve the collection name
async function getCollectionName() {
  try {
    let collectionName;
    const functions = Object.values(contract.interface.functions);
    let collectionNameMethodExists = functions.some((func) => func.name === 'collectionName');

    if (collectionNameMethodExists) {
      collectionName = await contract.collectionName();
      console.log('Retrieved collection name using the collectionName method.');
    } else {
      collectionName = await contract.name();
      console.log('Retrieved collection name using the name method.');
    }

    console.log('Contract Name:', collectionName);
    return collectionName || 'Unknown Collection';
  } catch (error) {
    console.log('Error retrieving collection name:', error.message);
    return 'Unknown Collection';
  }
}

  // Retrieve the collection name
  const collectionName = await getCollectionName();

  // Retrieve the token URIs
  let totalSupply = 0;
  if (contract.totalSupply) {
    totalSupply = await contract.totalSupply();
  } else if (contract.maxSupply) {
    totalSupply = await contract.maxSupply();
  }
  const batchSize = 20;
  const tokenURIs = [];

  let currentId = 0;

  while (currentId <= totalSupply) {
    const endId = Math.min(currentId + batchSize - 1, totalSupply);

    const batchTokenIds = Array.from({ length: endId - currentId + 1 }, (_, index) => currentId + index);

    const batchTokenURIs = await Promise.all(batchTokenIds.map(async (tokenId) => {
      try {
        const tokenURI = await contract.tokenURI(tokenId);

        if (tokenURI.startsWith('ipfs://')) {
          // If the tokenURI starts with "ipfs://", it's an IPFS link
          const cid = tokenURI.replace('ipfs://', '');
          const response = await axios.get(`https://ipfs.io/ipfs/${cid}`);
          const content = response.data;
          const uid = content.uid || null;
          
          const metadata = JSON.stringify(content);

          return {
            token_uri: `https://ipfs.io/ipfs/${cid}`,
            name: collectionName,
            token_address: contractAddress,
            token_id: tokenId.toString(),
            metadata: metadata
          };
        } else {
          // If the tokenURI doesn't start with "ipfs://", treat it as a regular link
          const cid = tokenURI;
          const response = await axios.get(`https://zkeagles.mypinata.cloud/ipfs/${cid}`);
          const content = response.data;
          const uid = content.uid || null;

          const metadata = JSON.stringify(content);

          return {
            token_uri: `https://zkeagles.mypinata.cloud/ipfs/${cid}`,
            name: collectionName,
            token_address: contractAddress,
            token_id: tokenId.toString(),
            metadata: metadata
          };
        }
      } catch (error) {
        console.log(`Error retrieving token URI for token ${tokenId}:`, error.message);
        return null;
      }
    }));

    tokenURIs.push(...batchTokenURIs);

    console.log(`Processed tokens from ${currentId} to ${endId}`);

    if (currentId === totalSupply) {
      console.log('Reached totalSupply');
    }
    currentId += batchSize;
  }

  const json = {
    total: Number(totalSupply),
    page: 0,
    page_size: 100,
    result: tokenURIs.filter((token) => token !== null)
  };

  const fileName = `${collectionName}.json`;

  // Write JSON object to a file
  fs.writeFile(fileName, JSON.stringify(json, null, 2), (err) => {
    if (err) {
      console.error('Error writing JSON file:', err);
    } else {
      console.log(`Token URIs saved to ${fileName}`);
    }
  });
}

// Run the main function
main().catch((error) => console.error(error));
