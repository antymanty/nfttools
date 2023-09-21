const fs = require('fs');
const path = require('path');

// Read the JSON file
const data = fs.readFileSync('Add your path');
const jsonData = JSON.parse(data);

const totalNFTs = jsonData.total;
const result = jsonData.result;

// Perform the calculations
const numTraitsList = [];
const traitsDf = [];

for (let i = 0; i < totalNFTs; i++) {
  const traitsForSingleNFT = JSON.parse(result[i].metadata).attributes;
  const numOfTraitsSingleNFT = traitsForSingleNFT.length;
  numTraitsList.push(numOfTraitsSingleNFT);

  traitsDf.push(...traitsForSingleNFT);
}

const allTraits = Array.from(new Set(traitsDf.map((trait) => trait.trait_type)));
const allTraitsWithCountsDf = [];

for (let i = 0; i < allTraits.length; i++) {
  const tempTraitDf = traitsDf.filter((trait) => trait.trait_type === allTraits[i]);
  const traitCounts = tempTraitDf.reduce((acc, trait) => {
    acc[trait.value] = acc[trait.value] ? acc[trait.value] + 1 : 1;
    return acc;
  }, {});

  const traitNonExist = totalNFTs - tempTraitDf.length;
  traitCounts['null'] = traitNonExist;

  const traitCountsNormalized = Object.fromEntries(
    Object.entries(traitCounts).map(([key, value]) => [key, 1 / (value / totalNFTs)])
  );

  allTraitsWithCountsDf.push({ trait_type: allTraits[i], counts: traitCountsNormalized });
}

const numOfTraitsSeries = numTraitsList.reduce((acc, num) => {
  acc[num] = acc[num] ? acc[num] + 1 : 1;
  return acc;
}, {});

const numOfTraitsSeriesNormalized = Object.fromEntries(
  Object.entries(numOfTraitsSeries).map(([key, value]) => [key, 1 / (value / totalNFTs)])
);

const numOfTraitsDf = { trait_type: 'Number Of Traits', counts: numOfTraitsSeriesNormalized };
allTraitsWithCountsDf.push(numOfTraitsDf);

// Sort and calculate rarity scores
const rarityScores = [];

for (let i = 0; i < totalNFTs; i++) {
  const traitsForSingleNFT = JSON.parse(result[i].metadata).attributes;
  const numOfTraitsSingleNFT = traitsForSingleNFT.length;
  const traitsForSingleNFTWithNum = [...traitsForSingleNFT, { trait_type: 'Number Of Traits', value: numOfTraitsSingleNFT }];

  allTraits.forEach((trait) => {
    const foundTrait = traitsForSingleNFTWithNum.find((t) => t.trait_type === trait);

    if (!foundTrait) {
      traitsForSingleNFTWithNum.push({ trait_type: trait, value: 'null' });
    }
  });

  const rarityScoresForNFT = traitsForSingleNFTWithNum.map((trait) => {
    const traitIndex = allTraitsWithCountsDf.findIndex((t) => t.trait_type === trait.trait_type);
    const rarityScore = allTraitsWithCountsDf[traitIndex].counts[trait.value];
    return {
      trait_type: trait.trait_type,
      value: trait.value,
      rarity_score: rarityScore,
    };
  });

  const sumOfRarities = rarityScoresForNFT.reduce((acc, trait) => acc + trait.rarity_score, 0);
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

const fileName = `${result[0].name}Full.json`;

const filePath = path.join(__dirname, fileName);

fs.writeFileSync(filePath, JSON.stringify(formattedOutput, null, 2));

console.log(`Formatted output written to ${filePath}`);

