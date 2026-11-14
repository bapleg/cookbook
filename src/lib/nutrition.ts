// Estimated nutrition for a recipe, computed from its ingredient lines.
// Values per 100 g (CIQUAL / USDA, rounded). Good enough to compare recipes, not a lab analysis.
import type { Recipe, Lang } from './types';
import { parseIngredient, normaliseFractions, parseServings, isSectionHeader, cleanLine } from './ingredients';

type Tag = 'fv' | 'legume' | 'heme' | 'vitc' | 'omega3' | 'refined' | 'gluten' | 'dairy' | 'egg' | 'spicy' | 'alcohol' | 'nuts' | 'wholegrain' | 'redmeat' | 'sugar';

interface Food {
  re: RegExp;
  //    kcal prot fat  sat  carb sugar fibre salt iron
  n: [number, number, number, number, number, number, number, number, number];
  piece?: number; // grams for one unit without a measure ("2 oignons")
  bunch?: number; // grams in a bunch
  tbsp?: number; // grams in one tablespoon (default 15 × density)
  dens?: number; // g per ml (default 1)
  tags?: Tag[];
}

const F = (re: RegExp, n: Food['n'], o: Omit<Food, 're' | 'n'> = {}): Food => ({ re, n, ...o });

// Order matters: specific names first.
const FOODS: Food[] = [
  // ── liquids that name other foods ("bouillon de volaille")
  F(/bouillon|stock|broth|fond de/, [8, 1, 0.3, 0.1, 0.5, 0.3, 0, 0.8, 0.1], { piece: 500 }),
  // ── fats & oils
  F(/huile|\boil\b/, [900, 0, 100, 14, 0, 0, 0, 0, 0], { dens: 0.92, tbsp: 13.5 }),
  F(/beurre de cacahu|peanut butter|beurre d'amande|almond butter|purée d'amandes?|purée de cajou|cashew butter/, [600, 25, 50, 10, 16, 9, 6, 1, 1.9], { tbsp: 16, tags: ['nuts'] }),
  F(/beurre|\bbutter\b|ghee/, [740, 0.7, 82, 52, 0.6, 0.6, 0, 0.1, 0], { tbsp: 14, tags: ['dairy'] }),
  F(/lait de coco|coconut milk|crème de coco|coconut cream/, [190, 1.8, 19, 17, 3, 2.5, 0, 0.05, 1], { piece: 400 }),
  F(/crème fraîche|creme fraiche|crème épaisse|thickened cream|double cream|sour cream|crème aigre/, [300, 2.4, 30, 20, 3, 3, 0, 0.1, 0.1], { tbsp: 15, piece: 200, tags: ['dairy'] }),
  F(/crème liquide|crème entière|crème|cream/, [290, 2.2, 30, 19, 3, 3, 0, 0.08, 0.1], { piece: 200, tags: ['dairy'] }),
  // ── dairy & eggs
  F(/lait d'amande|almond milk|lait d'avoine|oat milk|lait de soja|soy milk/, [40, 1, 1.5, 0.2, 5, 3, 0.5, 0.1, 0.3]),
  F(/\blait\b|\bmilk\b/, [64, 3.3, 3.6, 2.3, 4.8, 4.8, 0, 0.1, 0], { dens: 1.03, tags: ['dairy'] }),
  F(/yaourt grec|greek yog/, [100, 9, 5, 3.2, 4, 4, 0, 0.1, 0.1], { piece: 150, tags: ['dairy'] }),
  F(/yaourt|yogh?urt/, [60, 4, 3, 2, 5, 5, 0, 0.1, 0.1], { piece: 125, tags: ['dairy'] }),
  F(/parmesan|parmigiano|pecorino|grana/, [390, 33, 28, 18, 0, 0, 0, 1.6, 0.8], { tbsp: 6, tags: ['dairy'] }),
  F(/mozzarella|burrata/, [250, 18, 19, 13, 2, 1, 0, 0.5, 0.4], { piece: 125, tags: ['dairy'] }),
  F(/ricotta/, [150, 11, 10, 6, 3, 0.3, 0, 0.2, 0.4], { tags: ['dairy'] }),
  F(/feta/, [265, 14, 21, 15, 4, 4, 0, 2.7, 0.6], { tags: ['dairy'] }),
  F(/chèvre|goat.?s? cheese/, [290, 18, 23, 16, 2, 2, 0, 1.2, 1.5], { tags: ['dairy'] }),
  F(/mascarpone|cream cheese|fromage frais|philadelphia/, [400, 5, 42, 28, 4, 3, 0, 0.1, 0.1], { tags: ['dairy'] }),
  F(/gruy[eè]re|emmental|comté|cheddar|fromage râpé|grated cheese|halloumi|fromage|cheese/, [400, 27, 32, 20, 0.5, 0.5, 0, 1.2, 0.3], { tags: ['dairy'] }),
  F(/jaunes? d'?œufs?|jaunes? d'?oeufs?|egg yolks?/, [320, 16, 27, 9.5, 0.6, 0.6, 0, 0.1, 2.7], { piece: 18, tags: ['egg'] }),
  F(/blancs? d'?œufs?|blancs? d'?oeufs?|egg whites?/, [50, 11, 0.2, 0, 0.7, 0.7, 0, 0.4, 0.1], { piece: 33, tags: ['egg'] }),
  F(/œufs?|oeufs?|\beggs?\b|itlog/, [140, 12.5, 9.5, 2.8, 0.7, 0.4, 0, 0.35, 1.8], { piece: 55, tags: ['egg'] }),
  F(/tofu/, [130, 13, 7.5, 1.2, 2, 0.5, 1, 0.02, 2.5], { piece: 300, tags: ['legume'] }),
  // ── meat & fish
  F(/merguez|chorizo|saucisse|sausage|andouille|lardons?|bacon|jambon|\bham\b|pancetta/, [300, 15, 26, 9.5, 1, 0.5, 0, 2.3, 1.2], { piece: 60, tags: ['redmeat'] }),
  F(/b(?:œ|oe)uf|beef|steak|veau|\bveal\b|agneau|\blamb\b|\bmince\b|viande hachée|steak haché/, [220, 20, 15, 6, 0, 0, 0, 0.17, 2.5], { piece: 150, tags: ['heme', 'redmeat'] }),
  F(/porc|pork|baboy/, [215, 20, 14, 5, 0, 0, 0, 0.15, 1], { piece: 150, tags: ['heme', 'redmeat'] }),
  F(/lapin|rabbit/, [170, 21, 9, 3, 0, 0, 0, 0.12, 1.6], { piece: 200, tags: ['heme'] }),
  F(/canard|duck/, [200, 19, 14, 4, 0, 0, 0, 0.2, 2.7], { piece: 200, tags: ['heme'] }),
  F(/cuisses? de poulet|chicken thighs?|hauts? de cuisse|pilons?|drumsticks?/, [190, 18, 13, 3.6, 0, 0, 0, 0.2, 1], { piece: 100, tags: ['heme'] }),
  F(/poulet|chicken|volaille|dinde|turkey|manok/, [120, 23, 2.6, 0.7, 0, 0, 0, 0.15, 0.6], { piece: 170, tags: ['heme'] }),
  F(/saumon|salmon|truite|trout|maquereau|mackerel|sardine/, [200, 20, 13, 2.5, 0, 0, 0, 0.15, 0.4], { piece: 150, tags: ['heme', 'omega3'] }),
  F(/thon|tuna/, [115, 25, 1.5, 0.4, 0, 0, 0, 0.9, 1.3], { piece: 140, tags: ['heme', 'omega3'] }),
  F(/crevettes?|prawns?|shrimps?/, [85, 18, 1, 0.3, 0, 0, 0, 0.6, 0.5], { piece: 15, tags: ['heme'] }),
  F(/moules?|mussels?/, [86, 12, 2.2, 0.4, 3.7, 0, 0, 0.7, 4], { tags: ['heme'] }),
  F(/cabillaud|\bcod\b|colin|églefin|haddock|merlu|poisson blanc|white fish|daurade|bar\b|sea bass|\bfish\b|poisson|isda/, [82, 18, 0.7, 0.1, 0, 0, 0, 0.2, 0.4], { piece: 150, tags: ['heme'] }),
  F(/anchois|anchov/, [210, 29, 10, 2.2, 0, 0, 0, 9, 3], { piece: 4, tags: ['heme', 'omega3'] }),
  // ── legumes, grains & starches
  F(/pois chiches?|chickpeas?/, [140, 7.5, 2.5, 0.3, 18, 1, 6.5, 0.25, 2], { piece: 240, tags: ['legume', 'fv'] }),
  F(/lentilles?|lentils?|dal\b|dahl/, [115, 9, 0.5, 0.1, 17, 1.5, 7, 0.01, 3.3], { tags: ['legume', 'fv'] }),
  F(/haricots? (?:rouges?|noirs?|blancs?|borlotti|cannellini|pinto)|kidney beans?|black beans?|cannellini|white beans?|baked beans/, [125, 8.5, 0.5, 0.1, 17, 0.5, 7, 0.3, 2.5], { piece: 240, tags: ['legume', 'fv'] }),
  F(/edamame|fèves?|broad beans?/, [120, 11, 5, 0.6, 9, 2, 5, 0.01, 2.3], { tags: ['legume', 'fv'] }),
  F(/petits? pois|\bpeas\b/, [80, 5.4, 0.4, 0.1, 11, 4, 5.5, 0.01, 1.5], { tags: ['legume', 'fv'] }),
  F(/quinoa/, [370, 14, 6, 0.7, 64, 0, 7, 0.01, 4.6], { tags: [] }),
  F(/sarrasin|buckwheat|soba/, [345, 13, 3.4, 0.7, 70, 1, 10, 0.01, 2.2], { tags: ['wholegrain'] }),
  F(/flocons d'avoine|avoine|\boats?\b|porridge/, [380, 13, 7, 1.2, 60, 1, 10, 0.01, 4.7], { tags: ['wholegrain'] }),
  F(/galettes? de riz|feuilles? de riz|rice paper/, [330, 6, 0.5, 0.1, 80, 0, 1, 0.5, 1], { piece: 9, tags: ['refined'] }),
  F(/riz complet|brown rice|riz sauvage|wild rice/, [360, 7.5, 2.7, 0.5, 76, 0.7, 3.5, 0.01, 1.5], { tags: ['wholegrain'] }),
  F(/riz|\brice\b|arborio|basmati|bugas/, [355, 7, 0.6, 0.2, 79, 0.1, 1.3, 0.01, 0.8], { tags: ['refined'] }),
  F(/pâtes? complètes?|wholemeal pasta|whole ?wheat pasta/, [350, 13, 2.5, 0.5, 66, 3, 9, 0.01, 3.6], { tags: ['wholegrain', 'gluten'] }),
  F(/sans gluten|gluten[- ]free/, [355, 7, 1.5, 0.3, 77, 1, 3, 0.05, 1], { tags: ['refined'] }),
  F(/pâtes|\bpates?\b|pasta|spaghetti|tagliatelle|penne|coquillettes?|conchiglion|gigli|macaroni|fusilli|lasagne|nouilles?|noodles?|udon|vermicelle/, [355, 12.5, 1.5, 0.3, 72, 3, 3, 0.01, 1.3], { tags: ['refined', 'gluten'] }),
  F(/semoule|couscous|boulgour|bulgur/, [360, 12.5, 1.5, 0.3, 72, 1, 4, 0.02, 1.2], { tags: ['refined', 'gluten'] }),
  F(/farine de riz|rice flour|fécule|maïzena|cornflour|cornstarch|arrow-?root/, [360, 0.5, 0.1, 0, 88, 0, 0.5, 0.01, 0.3], { tbsp: 8, tags: ['refined'] }),
  F(/farine complète|wholemeal flour/, [340, 13, 2.5, 0.4, 62, 0.5, 10, 0.01, 3.5], { tbsp: 8, tags: ['wholegrain', 'gluten'] }),
  F(/farine|flour/, [350, 10, 1.2, 0.2, 74, 0.5, 2.7, 0.01, 1.2], { tbsp: 8, dens: 0.55, tags: ['refined', 'gluten'] }),
  F(/pâte feuilletée|pâte brisée|puff pastry|shortcrust/, [400, 6, 25, 12, 38, 1.5, 1.8, 1, 1], { piece: 230, tags: ['refined', 'gluten'] }),
  F(/pain complet|wholemeal bread/, [250, 10, 3, 0.6, 43, 3, 7, 1.1, 2.5], { piece: 35, tags: ['wholegrain', 'gluten'] }),
  F(/tortillas?|wraps?|pita|naan|pain|bread|baguette|brioche/, [275, 9, 3, 0.7, 52, 3.5, 3, 1.2, 1.6], { piece: 50, tags: ['refined', 'gluten'] }),
  F(/chapelure|breadcrumbs|panko/, [380, 12.5, 5, 1, 72, 6, 4.5, 1.2, 4.5], { tbsp: 7, tags: ['refined', 'gluten'] }),
  F(/patates? douces?|sweet potato/, [86, 1.6, 0.1, 0, 20, 4.2, 3, 0.1, 0.6], { piece: 250, tags: ['fv'] }),
  F(/pommes? de terre|potato|patates?/, [77, 2, 0.1, 0, 17, 0.8, 2.2, 0.01, 0.8], { piece: 170 }),
  F(/gnocchi/, [150, 4, 0.5, 0.1, 33, 1, 2, 0.8, 0.7], { tags: ['refined', 'gluten'] }),
  F(/maïs|\bcorn\b|polenta/, [85, 3, 1.2, 0.2, 17, 4.5, 2.5, 0.2, 0.5], { piece: 150, tags: ['fv'] }),
  // ── sugar, sweet things
  F(/sucre glace|icing sugar|sucre|sugar|cassonade|vergeoise|rapadura/, [400, 0, 0, 0, 100, 100, 0, 0, 0.1], { tbsp: 12, tags: ['sugar'] }),
  F(/miel|honey/, [305, 0.3, 0, 0, 82, 82, 0, 0, 0.4], { tbsp: 21, tags: ['sugar'] }),
  F(/sirop d'érable|maple syrup|sirop|syrup|agave/, [260, 0, 0, 0, 67, 60, 0, 0, 0.1], { tbsp: 20, tags: ['sugar'] }),
  F(/chocolat noir|dark chocolate/, [550, 7, 37, 22, 45, 28, 10, 0.02, 11], { tags: ['sugar'] }),
  F(/chocolat|chocolate|pépites/, [530, 6, 30, 18, 58, 52, 3, 0.2, 2.5], { tags: ['sugar'] }),
  F(/cacao|cocoa/, [350, 20, 14, 8, 12, 1, 33, 0.05, 14], { tbsp: 6 }),
  F(/confiture|\bjam\b/, [250, 0.4, 0.1, 0, 60, 55, 1, 0.03, 0.3], { tbsp: 20, tags: ['sugar'] }),
  // ── nuts & seeds
  F(/graines de sésame|sesame seeds|tahini|tahin|sésame/, [600, 18, 52, 7.5, 12, 0.5, 10, 0.03, 9], { tbsp: 9, tags: ['nuts'] }),
  F(/graines de (?:chia|lin|courge|tournesol)|chia|flax|linseed|pepitas|pumpkin seeds|sunflower seeds/, [520, 20, 38, 4, 15, 1, 22, 0.02, 7], { tbsp: 10, tags: ['omega3'] }),
  F(/noix de coco râpée|desiccated coconut/, [660, 7, 65, 57, 7, 7, 16, 0.04, 3.3], { tbsp: 6 }),
  F(/amandes?|almonds?|noix de cajou|cashews?|noisettes?|hazelnuts?|pistaches?|pistachios?|\bnoix\b(?! de (?:muscade|coco))|walnuts?|pecans?|\bpignons?\b|pine nuts|cacahu[eè]tes?|peanuts?/, [600, 20, 52, 5, 14, 4.5, 9, 0.01, 3.5], { tbsp: 9, piece: 1.2, tags: ['nuts'] }),
  F(/raisins secs|raisins|sultanas|dattes|dates|pruneaux|prunes|abricots secs|dried apricots|cranberries séchées/, [290, 2.5, 0.4, 0, 68, 62, 7, 0.03, 1.5], { piece: 8, tags: ['fv', 'sugar'] }),
  // ── condiments & sauces
  F(/tamari/, [60, 10, 0.1, 0, 5, 1.5, 0.8, 14.5, 2.4], { tbsp: 16 }),
  F(/sauce soja|soy sauce/, [60, 8, 0.1, 0, 6, 1.5, 0.8, 14.5, 2], { tbsp: 16, tags: ['gluten'] }),
  F(/sauce poisson|fish sauce|patis/, [35, 5, 0, 0, 3.6, 3.6, 0, 23, 0.8], { tbsp: 18 }),
  F(/concentré de tomate|tomato paste|tomato concentrate|purée de tomate/, [85, 4.3, 0.5, 0.1, 15, 12, 4, 0.2, 3], { tbsp: 16, piece: 70, tags: ['fv', 'vitc'] }),
  F(/passata|coulis de tomate|tomates? (?:concassées|pelées|en dés)|crushed tomato|chopped tomato|diced tomato|tinned tomato|canned tomato|sauce tomate|tomato sauce/, [32, 1.4, 0.2, 0, 5.5, 4, 1.5, 0.3, 0.9], { piece: 400, tags: ['fv', 'vitc'] }),
  F(/moutarde|mustard/, [150, 7, 11, 0.6, 5, 2, 4, 5.7, 1.5], { tbsp: 15 }),
  F(/mayonnaise/, [700, 1, 77, 6, 1, 1, 0, 1.2, 0.2], { tbsp: 14, tags: ['egg'] }),
  F(/ketchup/, [110, 1.2, 0.1, 0, 26, 22, 0.3, 1.8, 0.4], { tbsp: 17, tags: ['sugar'] }),
  F(/pesto/, [450, 5, 45, 7, 6, 1, 1.5, 2.3, 1], { tbsp: 15, tags: ['nuts', 'dairy'] }),
  F(/harissa|sriracha|sambal|chil(l)?i (?:paste|sauce)|pâte de piment/, [80, 3, 3, 0.4, 10, 5, 4, 4.5, 2], { tbsp: 15, tags: ['spicy'] }),
  F(/vinaigre|vinegar/, [20, 0, 0, 0, 0.5, 0.4, 0, 0, 0.2], { tbsp: 15 }),
  F(/\bvin\b|\bwine\b|bière|\bbeer\b|cidre|\bcider\b|cognac|\brhum\b|\brum\b/, [85, 0.1, 0, 0, 2.6, 0.8, 0, 0.01, 0.4], { tags: ['alcohol'] }),
  F(/olives?/, [145, 1, 15, 2, 4, 0, 3.3, 2.1, 0.5], { piece: 4, tags: ['fv'] }),
  F(/câpres?|capers/, [23, 2.4, 0.9, 0.2, 4.9, 0.4, 3.2, 7, 1.7], { tbsp: 9 }),
  F(/citrons? confits?|preserved lemons?/, [30, 0.5, 0.5, 0, 5, 2, 3, 6, 0.3], { piece: 60, tags: ['fv'] }),
  // ── spices (count salt, spice level, iron)
  F(/\bsel\b|\bsalt\b|fleur de sel/, [0, 0, 0, 0, 0, 0, 0, 100, 0], { tbsp: 18, piece: 2 }),
  F(/cayenne|piments? (?:rouges?|verts?|oiseau|d'espelette)|piment|chil(l)?i(?:es)?\b|chil(l)?i (?:flakes|powder)|jalape|scotch bonnet|bird.?s eye/, [320, 12, 17, 3, 57, 10, 35, 0.1, 8], { tbsp: 7, piece: 5, tags: ['spicy'] }),
  F(/curry|garam masala|ras el hanout|cumin|curcuma|turmeric|paprika|coriandre moulue|ground coriander|cannelle|cinnamon|muscade|nutmeg|gingembre moulu|ground ginger|sumac|za'?atar|herbes de provence|origan|oregano|thym séché|épices?|spices?|cardamome|clou de girofle|cloves?\b|anis|fenugrec|fenugreek/, [350, 13, 12, 2, 50, 3, 30, 0.1, 40], { tbsp: 7, piece: 1 }),
  F(/poivre|pepper(?:corns)?\b/, [255, 10, 3, 1, 64, 0.6, 25, 0.05, 10], { tbsp: 7, piece: 0.5 }),
  F(/levure|yeast|baking powder|bicarb/, [150, 0, 0, 0, 30, 0, 0, 20, 0], { tbsp: 10 }),
  F(/vanille|vanilla/, [290, 0, 0, 0, 13, 13, 0, 0, 0], { tbsp: 13 }),
  // ── vegetables (fv) — after compound names above
  F(/épinards?|spinach|blettes?|chard|kale|chou kale/, [25, 2.9, 0.4, 0.1, 1.5, 0.4, 2.2, 0.15, 2.7], { piece: 30, tags: ['fv', 'vitc'] }),
  F(/brocolis?|broccoli|chou-fleur|cauliflower|choux de bruxelles|brussels/, [34, 2.8, 0.4, 0.1, 4, 1.7, 2.6, 0.03, 0.7], { piece: 350, tags: ['fv', 'vitc'] }),
  F(/pak ?cho[iï]|bok ?choy|pe-?tsai/, [13, 1.5, 0.2, 0, 1.2, 1, 1, 0.1, 0.8], { piece: 150, tags: ['fv', 'vitc'] }),
  F(/chou|cabbage/, [25, 1.3, 0.1, 0, 3.5, 3, 2.5, 0.02, 0.5], { piece: 800, tags: ['fv', 'vitc'] }),
  F(/poivrons?|capsicums?|bell peppers?|padron|padrón/, [28, 1, 0.3, 0, 5, 4, 1.8, 0.01, 0.4], { piece: 160, tags: ['fv', 'vitc'] }),
  F(/tomates? cerises?|cherry tomato|tomates?|tomato/, [20, 0.9, 0.2, 0, 3, 2.6, 1.2, 0.01, 0.3], { piece: 120, tags: ['fv', 'vitc'] }),
  F(/oignons? verts?|spring onions?|cébettes?|ciboule|scallions?/, [30, 1.8, 0.2, 0, 5, 2, 2.6, 0.02, 1.5], { piece: 15, bunch: 100, tags: ['fv'] }),
  F(/échalotes?|shallots?/, [70, 2.5, 0.1, 0, 15, 8, 3, 0.01, 1.2], { piece: 30, tags: ['fv'] }),
  F(/oignons?|onions?/, [40, 1.1, 0.1, 0, 7.6, 4.2, 1.7, 0.01, 0.2], { piece: 150, tags: ['fv'] }),
  F(/poireaux?|leeks?/, [31, 1.5, 0.3, 0, 5, 3, 2, 0.01, 1], { piece: 200, tags: ['fv'] }),
  F(/\bail\b|garlic/, [140, 6.4, 0.5, 0.1, 28, 1, 2.1, 0.02, 1.7], { piece: 5, tags: ['fv'] }),
  F(/gingembre|ginger/, [80, 1.8, 0.75, 0.2, 18, 1.7, 2, 0.03, 0.6], { piece: 15, tags: ['fv'] }),
  F(/carottes?|carrots?/, [36, 0.8, 0.2, 0, 7, 5, 2.7, 0.08, 0.3], { piece: 80, tags: ['fv'] }),
  F(/courgettes?|zucchini|concombres?|cucumbers?/, [17, 1.2, 0.3, 0.1, 2.2, 2, 1, 0.01, 0.4], { piece: 200, tags: ['fv', 'vitc'] }),
  F(/aubergines?|eggplants?/, [23, 1, 0.2, 0, 3.5, 3, 2.5, 0.01, 0.2], { piece: 300, tags: ['fv'] }),
  F(/courges?|potiron|butternut|squash|pumpkin/, [35, 1, 0.1, 0, 7, 3, 2, 0.01, 0.6], { piece: 1000, tags: ['fv', 'vitc'] }),
  F(/champignons?|mushrooms?/, [22, 3.1, 0.3, 0, 1, 1, 1.5, 0.01, 0.4], { piece: 20, tags: ['fv'] }),
  F(/haricots? verts?|green beans?|asperges?|asparagus|mangetout|snow peas/, [28, 2, 0.2, 0, 4, 2, 3, 0.01, 1], { piece: 15, bunch: 250, tags: ['fv', 'vitc'] }),
  F(/betteraves?|beetroot|beets?/, [43, 1.6, 0.2, 0, 8, 7, 2.8, 0.2, 0.8], { piece: 150, tags: ['fv'] }),
  F(/céleri|celery|fenouil|fennel|panais|parsnips?|navets?|turnips?|radis|radish/, [30, 1, 0.2, 0, 5, 3, 2.5, 0.1, 0.4], { piece: 150, tags: ['fv'] }),
  F(/salade|laitue|lettuce|roquette|rocket|mesclun|mâche|cresson|watercress|greens|endive/, [17, 1.4, 0.2, 0, 2, 1, 1.8, 0.03, 1], { piece: 150, tags: ['fv', 'vitc'] }),
  F(/avocats?|avocados?/, [160, 2, 15, 2.1, 2, 0.7, 6.7, 0.01, 0.6], { piece: 170, tags: ['fv'] }),
  F(/artichauts?|artichokes?/, [47, 3.3, 0.2, 0, 6, 1, 5.4, 0.1, 1.3], { piece: 120, tags: ['fv'] }),
  F(/persil|parsley|coriandre|coriander|cilantro|basilic|basil|menthe|mint|ciboulette|chives|aneth|dill|estragon|tarragon|thym|thyme|romarin|rosemary|sauge|sage|laurier|bay|oseille|sorrel|herbes?|herbs?/, [40, 3, 0.7, 0.1, 6, 0.9, 4, 0.05, 6], { piece: 3, tbsp: 4, tags: ['fv', 'vitc'] }),
  F(/jus de citron|lemon juice|jus de citron vert|lime juice|citrons? verts?|limes?|citrons?|lemons?/, [25, 0.4, 0.2, 0, 7, 2.5, 0.3, 0, 0.1], { piece: 45, tags: ['fv', 'vitc'] }),
  F(/oranges?|mandarines?|clementines?/, [47, 0.9, 0.1, 0, 9, 9, 2.2, 0, 0.1], { piece: 150, tags: ['fv', 'vitc'] }),
  F(/bananes?|bananas?/, [90, 1.1, 0.3, 0.1, 20, 15, 2.6, 0, 0.3], { piece: 120, tags: ['fv'] }),
  F(/pommes?|apples?|poires?|pears?/, [53, 0.3, 0.2, 0, 12, 10, 2.4, 0, 0.1], { piece: 150, tags: ['fv'] }),
  F(/fraises?|strawberr|framboises?|raspberr|myrtilles?|blueberr|fruits rouges|berries|cerises?|cherr/, [40, 0.8, 0.3, 0, 7, 6, 2.5, 0, 0.5], { piece: 10, tags: ['fv', 'vitc'] }),
  F(/pastèque|watermelon|melon|mangues?|mangos?|ananas|pineapple|pêches?|peach|abricots?|apricots?|kiwis?|raisin|grapes?|tamarin|tamarind/, [45, 0.7, 0.2, 0, 10, 9, 1.2, 0, 0.3], { piece: 150, tags: ['fv', 'vitc'] }),
  F(/légumes?|vegetables?|veggies/, [30, 1.5, 0.2, 0, 5, 3, 2.5, 0.05, 0.6], { piece: 100, tags: ['fv'] }),
  F(/\beau\b|\bwater\b|glaçons|\bice\b/, [0, 0, 0, 0, 0, 0, 0, 0, 0])
];

export interface Nutrition {
  perServing: { kcal: number; protein: number; fat: number; satFat: number; carbs: number; sugars: number; starch: number; fibre: number; salt: number; iron: number };
  per100: { kcal: number; sugars: number; satFat: number; salt: number; protein: number; fibre: number };
  servings: number;
  gramsPerServing: number;
  fvShare: number; // % fruit/veg/legumes by weight
  coverage: number; // 0..1 share of ingredient lines recognised
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E';
  tags: Set<Tag>;
  foods: { line: string; grams: number; tags: Tag[]; food?: string }[];
}

function bracketGrams(line: string): number | null {
  if (/\bx\b|×/.test(line)) return null;
  const m = normaliseFractions(line).match(/\((?:[^)]*?\b)?(?:environ |about |approx\.? |~)?(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*\d+\s*)?(kg|g)\b/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return m[2] === 'kg' ? v * 1000 : v;
}

function gramsFor(food: Food, qty: number | null, unit: string, line: string): number | null {
  const dens = food.dens ?? 1;
  if (qty == null) {
    // no quantity ("sel", "coriandre pour servir"): a pinch / garnish
    if (food.tags?.includes('fv') && /\b(servir|garnish|décor|serve|pour la déco)/i.test(line)) return 5;
    return food.n[7] >= 90 ? 2 : food.piece ? Math.min(food.piece, 10) : null;
  }
  switch (unit) {
    case 'g': return qty;
    case 'kg': return qty * 1000;
    case 'ml': return qty * dens;
    case 'cl': return qty * 10 * dens;
    case 'dl': return qty * 100 * dens;
    case 'l': return qty * 1000 * dens;
    case 'cs': return qty * (food.tbsp ?? 15 * dens);
    case 'cc': return qty * ((food.tbsp ?? 15 * dens) / 3);
    case 'cup': return qty * 240 * dens;
    case 'pincée': return qty * 0.5;
    case 'gousse': return qty * 5;
    case 'boîte': return bracketGrams(line) || qty * (food.piece && food.piece >= 200 ? food.piece : 400);
    case 'botte': return qty * (food.bunch ?? (food.piece && food.piece <= 5 ? 30 : 100));
    case 'tranche': return qty * 30;
    case 'filet': return qty * (food.piece ?? 150);
    case 'feuille': return qty * 1;
    case 'branche': return qty * 2;
    case 'sachet': return qty * 10;
    case 'paquet': return qty * 250;
    case 'oz': return qty * 28;
    case 'lb': return qty * 454;
    default: {
      // "4 carottes (500 g)": the weight in brackets is the total for the line
      const br = bracketGrams(line);
      if (br) return br;
      // "x 170 g" style secondary weights in the line: "4 x 170 g filets de saumon"
      const w = normaliseFractions(line).match(/(\d+(?:[.,]\d+)?)\s*g\b/);
      if (w && /\bx\b|×/.test(line)) return qty * parseFloat(w[1].replace(',', '.'));
      return qty * (food.piece ?? 100);
    }
  }
}

const SCALE = (v: number, steps: number[]) => steps.filter((s) => v > s).length;

export function nutriScore(p100: Nutrition['per100'], fvShare: number, redMeat: boolean): Nutrition['nutriScore'] {
  const kj = p100.kcal * 4.184;
  const N =
    SCALE(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) +
    SCALE(p100.sugars, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]) +
    SCALE(p100.satFat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    SCALE(p100.salt, [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]);
  let protein = SCALE(p100.protein, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  if (redMeat) protein = Math.min(protein, 2);
  const fibre = SCALE(p100.fibre, [3, 4.1, 5.2, 6.3, 7.4]);
  const fv = fvShare > 80 ? 5 : fvShare > 60 ? 2 : fvShare > 40 ? 1 : 0;
  const P = (N >= 11 ? 0 : protein) + fibre + fv;
  const s = N - P;
  return s <= 0 ? 'A' : s <= 2 ? 'B' : s <= 10 ? 'C' : s <= 18 ? 'D' : 'E';
}

const cache = new Map<string, Nutrition | null>();

/** Nutrition for a recipe, from its French text (most complete), else English. */
export function nutritionOf(r: Recipe): Nutrition | null {
  const key = `${r.id}:${r.updatedAt || 0}`;
  if (cache.has(key)) return cache.get(key)!;
  const t = (['fr', 'en', 'vi'] as Lang[]).map((l) => r[l]).find((x) => x && x.ingredients?.length);
  if (!t) {
    cache.set(key, null);
    return null;
  }
  const servings = parseServings(r.servings) || 4;
  const tot = { kcal: 0, protein: 0, fat: 0, satFat: 0, carbs: 0, sugars: 0, fibre: 0, salt: 0, iron: 0 };
  let grams = 0;
  let fvGrams = 0;
  let lines = 0;
  let matched = 0;
  const tags = new Set<Tag>();
  const foods: Nutrition['foods'] = [];
  for (const raw of t.ingredients) {
    const line = cleanLine(raw);
    if (!line || isSectionHeader(line)) continue;
    lines++;
    const p = parseIngredient(line);
    const hay = (p.name + ' ' + line).toLowerCase();
    const food = FOODS.find((f) => f.re.test(hay));
    if (!food) continue;
    const g = gramsFor(food, p.qty, p.unit, line);
    if (g == null || !isFinite(g)) continue;
    matched++;
    const k = g / 100;
    const [kcal, prot, fat, sat, carb, sug, fib, salt, iron] = food.n;
    tot.kcal += kcal * k;
    tot.protein += prot * k;
    tot.fat += fat * k;
    tot.satFat += sat * k;
    tot.carbs += carb * k;
    tot.sugars += sug * k;
    tot.fibre += fib * k;
    tot.salt += salt * k;
    tot.iron += iron * k;
    // water, stock and wine mostly evaporate or are not "food weight" for per-100 g ratios
    const effective = /\beau\b|\bwater\b|bouillon|stock|broth|vin\b|wine/.test(hay) ? g * 0.3 : g;
    grams += effective;
    if (food.tags?.includes('fv')) fvGrams += effective;
    (food.tags || []).forEach((tg) => tags.add(tg));
    foods.push({ line, grams: g, tags: food.tags || [], food: food.re.source.slice(0, 30) });
  }
  if (!matched || grams < 50) {
    cache.set(key, null);
    return null;
  }
  const per = (v: number) => Math.round((v / servings) * 10) / 10;
  const p100 = (v: number) => (v / grams) * 100;
  const fvShare = Math.round((fvGrams / grams) * 100);
  const per100 = { kcal: p100(tot.kcal), sugars: p100(tot.sugars), satFat: p100(tot.satFat), salt: p100(tot.salt), protein: p100(tot.protein), fibre: p100(tot.fibre) };
  const n: Nutrition = {
    perServing: {
      kcal: Math.round(tot.kcal / servings),
      protein: per(tot.protein),
      fat: per(tot.fat),
      satFat: per(tot.satFat),
      carbs: per(tot.carbs),
      sugars: per(tot.sugars),
      starch: per(Math.max(0, tot.carbs - tot.sugars)),
      fibre: per(tot.fibre),
      salt: per(tot.salt),
      iron: per(tot.iron)
    },
    per100,
    servings,
    gramsPerServing: Math.round(grams / servings),
    fvShare,
    coverage: matched / lines,
    nutriScore: nutriScore(per100, fvShare, tags.has('redmeat')),
    tags,
    foods
  };
  cache.set(key, n);
  return n;
}

export type { Tag as NutriTag };
