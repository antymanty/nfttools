const { ethers } = require("ethers");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

async function main() {
  // Set up the provider
  const provider = new ethers.providers.JsonRpcProvider(
    "https://..." // Add RPC link
  );

  // Set up the contract instance
  const contractAddress = "0x......"; // Add address here
  const erc721ABI = [
    // Add any additional ERC721 ABI components here
    // You can find the ABI on Etherscan or generate it from the contract source code
    {
      constant: true,
      inputs: [],
      name: "name",
      outputs: [
        {
          name: "",
          type: "string",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
    {
      constant: true,
      inputs: [
        {
          name: "tokenId",
          type: "uint256",
        },
      ],
      name: "tokenURI",
      outputs: [
        {
          name: "",
          type: "string",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
    {
      constant: true,
      inputs: [],
      name: "maxSupply",
      outputs: [
        {
          name: "",
          type: "uint256",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
    {
      constant: true,
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          name: "",
          type: "uint256",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ];
  const contract = new ethers.Contract(contractAddress, erc721ABI, provider);

  // Retrieve the collection name
  async function getCollectionName() {
    try {
      let collectionName;
      const functions = Object.values(contract.interface.functions);
      let collectionNameMethodExists = functions.some(
        (func) => func.name === "collectionName"
      );

      if (collectionNameMethodExists) {
        collectionName = await contract.collectionName();
        console.log(
          "Retrieved collection name using the collectionName method."
        );
      } else {
        collectionName = await contract.name();
        console.log("Retrieved collection name using the name method.");
      }

      console.log("Contract Name:", collectionName);
      return collectionName || "Unknown Collection";
    } catch (error) {
      console.log("Error retrieving collection name:", error.message);
      return "Unknown Collection";
    }
  }

  // Retrieve the collection name
  const collectionName = await getCollectionName();

  if (collectionName === "Unknown Collection") {
    console.error("Failed to retrieve collection name");
    return;
  }

  // Retrieve the total supply of tokens
  async function getTotalSupply() {
    try {
      const totalSupply = await contract.totalSupply();
      return totalSupply;
    } catch (error) {
      console.log(`Error retrieving total supply:`, error.message);
      return null;
    }
  }

  // Retrieve the total supply of tokens
  const totalSupply = await getTotalSupply();

  if (totalSupply === null) {
    console.error("Failed to retrieve total supply");
    return;
  }

  let currentId = 0;
  const batchSize = 100;

  // Define tokenURIs before the while loop
  let tokenURIs = [];

  const maxRetries = 3; // Maximum number of retries

  while (currentId <= totalSupply) {
    const endId = Math.min(currentId + batchSize - 1, totalSupply);

    const batchTokenURIs = await Promise.all(
      Array.from(
        { length: endId - currentId + 1 },
        (_, i) => currentId + i
      ).map(async (tokenId, index) => {
        let retries = 0;

        while (retries < maxRetries) {
          try {
            // Add a delay before each request, except for the first one
            if (index > 0) {
              await new Promise((resolve) => setTimeout(resolve, 200)); // 100ms delay
            }

            const tokenURI = await contract.tokenURI(tokenId);

            if (tokenURI.startsWith("ipfs://")) {
              // If the tokenURI starts with "ipfs://", it's an IPFS link
              const cid = tokenURI.replace("ipfs://", "");
              const response = await axios.get(`https://ipfs.io/ipfs/${cid}`);
              const content = response.data;

              const metadata = JSON.stringify(content);

              return {
                token_uri: `https://ipfs.io/ipfs/${cid}`,
                name: collectionName,
                token_address: contractAddress,
                token_id: tokenId.toString(),
                metadata: metadata,
              };
            }
          } catch (error) {
            console.log(
              `Error retrieving token URI for token ${tokenId}:`,
              error.message
            );

            // If the error is a 404 and the token ID is 0, retry with token ID 1
            if (
              error.response &&
              error.response.status === 404 &&
              tokenId === 0
            ) {
              console.log("Token ID 0 not found, retrying with token ID 1...");
              tokenId = 1;
              continue;
            }

            retries++;

            if (retries === maxRetries) {
              console.log(
                `Failed to retrieve token URI for token ${tokenId} after ${maxRetries} attempts.`
              );
              return null;
            }

            console.log(
              `Retrying token ${tokenId} (${retries}/${maxRetries})...`
            );

            // Wait for 1 second before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      })
    );

    tokenURIs.push(...batchTokenURIs);

    console.log(`Processed tokens from ${currentId} to ${endId}`);

    if (currentId === totalSupply) {
      console.log("Reached totalSupply");
    }
    currentId += batchSize;
  }

  const json = {
    total: Number(totalSupply),
    page: 0,
    page_size: 100,
    result: tokenURIs.filter((token) => token !== null),
  };

  // Perform the calculations
  const numTraitsList = [];
  const traitsDf = [];

  // Define totalNFTs before the for loop
  const totalNFTs = json.total;

  // Define result before the for loop
  const result = json.result;

  for (let i = 0; i < totalNFTs; i++) {
    const traitsForSingleNFT = JSON.parse(result[i].metadata).attributes;
    const numOfTraitsSingleNFT = traitsForSingleNFT.length;
    numTraitsList.push(numOfTraitsSingleNFT);

    traitsDf.push(...traitsForSingleNFT);
  }

  const allTraits = Array.from(
    new Set(traitsDf.map((trait) => trait.trait_type))
  );
  const allTraitsWithCountsDf = [];

  for (let i = 0; i < allTraits.length; i++) {
    const tempTraitDf = traitsDf.filter(
      (trait) => trait.trait_type === allTraits[i]
    );
    const traitCounts = tempTraitDf.reduce((acc, trait) => {
      acc[trait.value] = acc[trait.value] ? acc[trait.value] + 1 : 1;
      return acc;
    }, {});

    const traitNonExist = totalNFTs - tempTraitDf.length;
    traitCounts["null"] = traitNonExist;

    const traitCountsNormalized = Object.fromEntries(
      Object.entries(traitCounts).map(([key, value]) => [
        key,
        1 / (value / totalNFTs),
      ])
    );

    allTraitsWithCountsDf.push({
      trait_type: allTraits[i],
      counts: traitCountsNormalized,
    });
  }

  const numOfTraitsSeries = numTraitsList.reduce((acc, num) => {
    acc[num] = acc[num] ? acc[num] + 1 : 1;
    return acc;
  }, {});

  const numOfTraitsSeriesNormalized = Object.fromEntries(
    Object.entries(numOfTraitsSeries).map(([key, value]) => [
      key,
      1 / (value / totalNFTs),
    ])
  );

  const numOfTraitsDf = {
    trait_type: "Number Of Traits",
    counts: numOfTraitsSeriesNormalized,
  };
  allTraitsWithCountsDf.push(numOfTraitsDf);

  // Sort and calculate rarity scores
  const rarityScores = [];

  for (let i = 0; i < totalNFTs; i++) {
    const traitsForSingleNFT = JSON.parse(result[i].metadata).attributes;
    const numOfTraitsSingleNFT = traitsForSingleNFT.length;
    const traitsForSingleNFTWithNum = [
      ...traitsForSingleNFT,
      { trait_type: "Number Of Traits", value: numOfTraitsSingleNFT },
    ];

    allTraits.forEach((trait) => {
      const foundTrait = traitsForSingleNFTWithNum.find(
        (t) => t.trait_type === trait
      );

      if (!foundTrait) {
        traitsForSingleNFTWithNum.push({
          trait_type: trait,
          value: "null",
        });
      }
    });

    const rarityScoresForNFT = traitsForSingleNFTWithNum.map((trait) => {
      const traitIndex = allTraitsWithCountsDf.findIndex(
        (t) => t.trait_type === trait.trait_type
      );
      const rarityScore = allTraitsWithCountsDf[traitIndex].counts[trait.value];
      return {
        trait_type: trait.trait_type,
        value: trait.value,
        rarity_score: rarityScore,
      };
    });

    const sumOfRarities = rarityScoresForNFT.reduce(
      (acc, trait) => acc + trait.rarity_score,
      0
    );
    rarityScores.push({
      index: i.toString(),
      token_uri: result[i].token_uri,
      name: result[i].name,
      token_address: result[i].token_address,
      token_id: result[i].token_id,
      metadata: result[i].metadata,
      rarity_scores: rarityScoresForNFT,
      total_rarity_score: sumOfRarities,
    });
  }

  // Sort by total rarity score in descending order
  rarityScores.sort((a, b) => b.total_rarity_score - a.total_rarity_score);

  // Create the final formatted output
  const formattedOutput = {};

  for (let i = 0; i < rarityScores.length; i++) {
    formattedOutput[i.toString()] = {
      token_uri: rarityScores[i].token_uri,
      name: rarityScores[i].name,
      token_address: rarityScores[i].token_address,
      token_id: rarityScores[i].token_id,
      metadata: rarityScores[i].metadata,
      rarity_scores: JSON.stringify(rarityScores[i].rarity_scores),
      total_rarity_score: rarityScores[i].total_rarity_score,
    };
  }

  const directoryPath = path.join(__dirname, "rarity");

  // Create the directory if it doesn't exist
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath);
  }

  const fileName = `${result[0].name}.json`;
  const filePath = path.join(directoryPath, fileName);

  fs.writeFileSync(filePath, JSON.stringify(formattedOutput, null, 2));

  console.log(`Formatted output written to ${filePath}`);
}

main().catch(console.error);
