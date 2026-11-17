// RedMart (bêta) — products the family already bought, taken from past order confirmations
// (Oct–Nov 2026). Used to link shopping-list lines to the exact product bought before.
// `k` is matched (case-insensitive) against the ingredient name in French or English.
// Order matters: the first match wins, so specific products come before generic ones.

export interface RedmartProduct {
  n: string; // product name on RedMart
  id: string; // lazada product id
  size?: string;
  k: string; // regex source
}

export const REDMART_PRODUCTS: RedmartProduct[] = [
  // ── stock first ("bouillon de poulet" is not chicken)
  { n: 'Heinz Chicken Broth 25% Reduced Sodium 1L', id: 'i13921509279-s124942936300', size: '1 L', k: '(?<!beef )(?:stock|broth)|bouillon(?! de b(?:œ|oe)uf)' },
  // ── dairy & eggs
  { n: 'Danaeg Organic Free Range 10 Eggs', id: 'i1129940124-s4384466541', size: '10', k: "œufs?|oeufs?|\\beggs?\\b|jaunes? d'|blancs? d'" },
  { n: 'Brownes Dairy Greek Style Yoghurt - Plain', id: 'i2702380132-s17946118019', size: '1 L', k: 'yaourt|yogh?urt' },
  { n: 'Kara Organic Coconut Milk 200ML', id: 'i1844317684-s9829424734', size: '200 ml', k: 'lait de coco|coconut milk|crème de coco' },
  { n: 'Marigold 100% Fresh Milk 1.89L', id: 'i301078891-s527100771', size: '1.89 L', k: '\\blait\\b|\\bmilk\\b' },
  { n: 'Monoprix Gourmet Thick Isigny Crème Fraîche 200g', id: 'i13700146299-s124604624277', size: '200 g', k: 'crème fraîche|creme fraiche|crème épaisse' },
  { n: 'Tatua Sour Cream', id: 'i303280244-s536586342', size: '500 g', k: 'sour cream|crème aigre' },
  { n: 'LE GALL Unsalted Butter', id: 'i303254854-s536592368', size: '250 g', k: "beurre(?! de cacahu| d'amande)|(?<!almond |peanut |nut )\\bbutter\\b" },
  { n: 'Monoprix Gourmet Parmigiano Reggiano Grated 70G', id: 'i1711759180-s8334417757', size: '70 g', k: 'parmesan râpé|grated parmesan' },
  { n: 'Perfect Italiano Parmesan Block 250G', id: 'i301198014-s527268204', size: '250 g', k: 'parmesan|parmigiano' },
  { n: 'Greenfields Ricotta Cheese 250G', id: 'i303614446-s537274199', size: '250 g', k: 'ricotta' },
  { n: 'Kolios Authentic Greek Feta', id: 'i2634307789-s16772993862', size: '150 g', k: 'feta' },
  { n: 'Monoprix Gourmet Mozzarella di Bufala', id: 'i3496295016-s23107547518', size: '250 g', k: 'mozzarella|burrata' },
  { n: 'RedMart UK Matured Cheddar', id: 'i3089662018-s21053075397', size: '250 g', k: 'cheddar|fromage râpé|grated cheese' },
  { n: 'Unicurd Organic Taukwa (firm tofu)', id: 'i301150708-s527232290', size: '400 g', k: 'tofu' },
  // ── meat & fish
  { n: 'Great Hill Farms Fresh Whole Chicken 1.4KG', id: 'i2960259345-s20360446592', size: '1.4 kg', k: 'poulet entier|whole chicken' },
  { n: 'Great Hill Farms Chicken Leg Boneless', id: 'i2960185863-s20360903586', size: '200 g', k: 'cuisses? de poulet|hauts? de cuisse|chicken (?:drumsticks?|thighs?|legs?)|pilons?' },
  { n: 'Fresh Sakura Chicken Boneless Skinless Breast 350G', id: 'i13659900188-s124271301879', size: '350 g', k: 'poulet|chicken|blancs? de volaille' },
  { n: 'Master Grocer Grassfed Minced Beef - Frozen', id: 'i305132530-s541250234', size: '500 g', k: 'b(?:œ|oe)uf haché|viande hachée|beef mince|steak haché|minced beef' },
  { n: 'RedMart Grass Fed Lamb Mince - Frozen', id: 'i819520732-s2740846396', size: '500 g', k: 'agneau haché|lamb mince' },
  { n: 'Picard 2 Pieces Organic Atlantic Salmon - Frozen', id: 'i985254114-s3559052981', size: '200 g', k: 'saumon|salmon' },
  { n: 'Zarotti Italian Anchovy Fillets 80g', id: 'i3273522956-s22017589677', size: '80 g', k: 'anchois|anchov' },
  { n: "The Gourmet's Pack Pork Chipolata 5s", id: 'i303370379-s536700979', size: '200 g', k: 'chipolatas?|saucisses?(?! merguez)|(?<!merguez )sausages?' },
  // ── pulses, grains, pasta
  { n: "Sainsbury's Organic Chickpeas", id: 'i303960263-s538030702', size: '380 g', k: 'pois chiches?|chickpeas?' },
  { n: 'RedMart Organic Split Red Lentils', id: 'i304010184-s538094764', size: '1 kg', k: 'lentilles? corail|red lentils?|masoor' },
  { n: "Sainsbury's Green Lentils In Water", id: 'i303952359-s538052167', size: '400 g', k: 'lentilles? vertes? (?:en boîte|cuites)|tinned green lentils' },
  { n: 'Suma Organic Brown Lentils', id: 'i1794643052-s9437451091', size: '500 g', k: 'lentilles?|lentils?' },
  { n: "Sainsbury's So Organic Red Kidney Beans 380G", id: 'i2979278580-s20456444586', size: '380 g', k: 'haricots? rouges?|kidney beans?' },
  { n: 'Six Fortune Soba Buckwheat Noodles', id: 'i13754841561-s124721306814', size: '300 g', k: 'soba|nouilles? de sarrasin' },
  { n: 'RedMan Buckwheat 500G', id: 'i3586508342-s23668207804', size: '500 g', k: 'sarrasin|buckwheat' },
  { n: "Pasta D'Alba Organic Gluten Free Tagliatelle 250G", id: 'i13702639154-s124619208212', size: '250 g', k: '(?:pâtes|pasta|tagliatelle)[^,]*sans gluten|gluten[- ]free (?:pasta|tagliatelle)' },
  { n: "Sainsbury's Conchiglie Shells Pasta 500G", id: 'i2979310012-s20456087285', size: '500 g', k: 'conchigli|coquillettes?|penne|macaroni|pâtes(?! à| filo| de curry)|\\bpasta\\b' },
  { n: 'San Remo Instant Lasagna Sheets', id: 'i301156286-s527210092', size: '250 g', k: 'lasagn' },
  { n: 'San Remo Cous Cous', id: 'i301152334-s527176836', size: '500 g', k: 'couscous|semoule' },
  { n: "Bob's Red Mill Gluten Free All Purpose Baking Flour", id: 'i303046704-s536340525', size: '624 g', k: 'farine sans gluten|gluten[- ]free flour' },
  { n: 'Prima Plain Flour 1KG', id: 'i301110837-s527092792', size: '1 kg', k: "farine(?! d.amande| de riz| de sarrasin| de coco| de pois)|(?<!almond |rice |buckwheat |coconut )\\bflour\\b(?! tortilla)" },
  { n: 'Taste Original Organic Arrowroot Starch', id: 'i304082731-s538216946', size: '200 g', k: 'arrow-?root|fécule' },
  { n: 'Sanitarium Weet-Bix Whole Grain Cereal', id: 'i301116506-s527198236', size: '375 g', k: 'weet-?bix|céréales|cereals?' },
  { n: 'The Whole Kitchen Gluten Free Country Loaf', id: 'i304026846-s538152971', size: '700 g', k: 'pain sans gluten|gluten[- ]free bread' },
  { n: 'Gardenia Original Wholemeal Bread', id: 'i301110819-s527092746', size: '600 g', k: 'pain complet|pain de mie|wholemeal bread|(?<!pita )\\bbread\\b|\\bpain\\b(?! pita)' },
  { n: 'RedMart Freshly Made Wholemeal Wraps', id: 'i301188131-s527242672', size: '6', k: 'wraps?|tortillas?' },
  { n: 'Monoprix Rolled Shortcrust Pastry 230G', id: 'i462720253-s1244656978', size: '230 g', k: 'pâte brisée|shortcrust' },
  // ── tins, jars, condiments
  { n: 'Mutti Double Concentrated Tomato Paste', id: 'i303246455-s536568300', size: '130 g', k: 'concentré de tomate|tomato paste|tomato concentrate' },
  { n: "Sainsbury's Passata", id: 'i303954354-s538044347', size: '500 g', k: 'passata|coulis de tomate|purée de tomate|tomato puree' },
  { n: 'RedMart Italian Chopped Tomatoes', id: 'i301162260-s527254520', size: '400 g', k: 'tomates? (?:concassées|pelées|en dés|en boîte)|chopped tomato|crushed tomato|tinned tomato|diced tomato' },
  { n: 'Kikkoman Less Salt Soy Sauce', id: 'i301124564-s527218282', size: '600 ml', k: 'sauce soja|soy sauce|tamari\\b' },
  { n: "Sainsbury's Toasted Sesame Oil 250ML", id: 'i3460554939-s22949913105', size: '250 ml', k: 'huile de sésame|sesame oil' },
  { n: 'RedMart Pure Olive Oil 2L', id: 'i303986658-s538104499', size: '2 L', k: "huile d'olive|olive oil" },
  { n: 'Naturel Canola & Sunflower Oil 2L', id: 'i301110858-s527092863', size: '2 L', k: 'huile (?:de tournesol|de colza|neutre|végétale)|canola oil|sunflower oil|vegetable oil' },
  { n: 'Cypressa Hulled Tahini 300g', id: 'i303398412-s536734816', size: '300 g', k: 'tahini|tahin' },
  { n: 'Kuki Roasted White Sesame Seeds', id: 'i303712102-s537382617', size: '60 g', k: 'graines de sésame|sesame seeds|sésame' },
  { n: 'Forty Thieves Peanut Butter - Smooth', id: 'i1552048276-s7266126790', size: '500 g', k: 'beurre de cacahu[eè]tes?|peanut butter' },
  { n: 'RedMart Roasted Almond Nut Butter', id: 'i1708956154-s8314112616', size: '300 g', k: "beurre d'amande|purée d'amandes?|almond butter" },
  { n: 'Monoprix Organic Pesto 190G', id: 'i603360142-s1758644117', size: '190 g', k: 'pesto' },
  { n: 'Hosen Select Pitted Green Olives 345g', id: 'i14001180962-s125062322345', size: '345 g', k: 'olives? vertes?|green olives' },
  { n: "Sainsbury's Capucine Capers", id: 'i303972108-s538028807', size: '198 g', k: 'câpres?|capers' },
  { n: 'Colavita White Wine Vinegar', id: 'i328562605-s698924573', size: '500 ml', k: 'vinaigre de vin blanc|white wine vinegar' },
  { n: 'Ortalli Balsamic Vinegar', id: 'i3184669728-s21658760914', size: '500 ml', k: 'balsami' },
  { n: 'Organic Tattva Turmeric Powder', id: 'i3652953362-s24146455808', size: '200 g', k: 'curcuma|turmeric' },
  { n: 'Goldtree Special Caster Sugar 250G', id: 'i3514643065-s23198922299', size: '250 g', k: 'sucre(?! glace| roux| brun)|caster sugar' },
  { n: 'SiS Fine Brown Sugar', id: 'i301154195-s527184725', size: '800 g', k: 'sucre (?:roux|brun)|cassonade|brown sugar' },
  { n: 'Bake King Baking Powder', id: 'i301152347-s527176854', size: '70 g', k: 'levure chimique|baking powder' },
  { n: 'Bake King Bicarbonate of Soda', id: 'i301116482-s527198176', size: '100 g', k: 'bicarb' },
  { n: 'Bakeway Dark Chocolate Chips', id: 'i328574580-s698938394', size: '250 g', k: 'pépites de chocolat|chocolate chips' },
  { n: 'RedMart Pine Nuts', id: 'i303104230-s536392284', size: '100 g', k: 'pignons?|pine nuts' },
  { n: 'Foodsterr USA Walnut Pieces', id: 'i303590902-s537284067', size: '250 g', k: 'cerneaux|\\bnoix\\b(?! de (?:coco|muscade|cajou))|walnuts?' },
  { n: 'RedMart Pitted Prunes', id: 'i303064310-s536362394', size: '200 g', k: 'pruneaux|prunes' },
  { n: 'Malika Golden Raisins 250g', id: 'i303712658-s537414428', size: '250 g', k: 'raisins secs|raisins|sultanas' },
  // ── fruit & veg
  { n: 'Cavendish Banana', id: 'i318280599-s611558185', size: '700 g', k: 'bananes?|bananas?(?! pepper)' },
  { n: 'New Zealand Avocado 3s', id: 'i1927079497-s10306610907', size: '3', k: "(?<!huile d.)avocats?|avocados?(?! oil)" },
  { n: 'RedMart Unwaxed Lemons', id: 'i1548788612-s7249264792', size: '650 g', k: 'citrons?(?! verts?| confits?)|(?<!preserved )lemons?' },
  { n: 'Large Seedless Limes', id: 'i301090790-s527090746', size: '250 g', k: 'citrons? verts?|limes?' },
  { n: 'RedMart Baby Spinach Salad (washed)', id: 'i1988693563-s10772039078', size: '100 g', k: 'pousses? d.épinards?|jeunes pousses|baby spinach' },
  { n: 'Picard Spinach Leaves - Frozen', id: 'i464136696-s1248990242', size: '600 g', k: 'épinards?|spinach' },
  { n: 'RedMart Green Coral Lettuce Salad', id: 'i2149806785-s12237516910', size: '180 g', k: 'salade|laitue|lettuce|mesclun|salad greens' },
  { n: 'Picard Organic Broccoli Florets - Frozen', id: 'i464158606-s1248978302', size: '600 g', k: 'brocolis?|broccoli' },
  { n: 'RedMart Cauliflower 450G Australia', id: 'i301094802-s527070979', size: '450 g', k: 'chou-fleur|cauliflower' },
  { n: 'RedMart Red Capsicum', id: 'i327236655-s692080569', size: '200 g', k: 'poivrons?|capsicums?|bell peppers?' },
  { n: 'RedMart Cherry Tomato', id: 'i327264049-s692104083', size: '250 g', k: 'tomates? cerises?|cherry tomato' },
  { n: 'RedMart Green Zucchini', id: 'i327266027-s692090585', size: '750 g', k: 'courgettes?|zucchini' },
  { n: 'RedMart Round Eggplant', id: 'i327232813-s692084640', size: '300 g', k: 'aubergines?|eggplants?' },
  { n: 'RedMart Japanese Cucumber', id: 'i327250341-s692072902', size: '400 g', k: 'concombres?|cucumbers?' },
  { n: 'RedMart Carrots 500G Australia', id: 'i303998239-s538088935', size: '500 g', k: 'carottes?|carrots?' },
  { n: 'Orange Sweet Potatoes 500G', id: 'i304966875-s541086848', size: '500 g', k: 'patates? douces?|sweet potato' },
  { n: 'Australian White Washed Potatoes', id: 'i301172191-s527262284', size: '1 kg', k: 'pommes? de terre|potato' },
  { n: 'Australia Red Onions', id: 'i301088827-s527072957', size: '500 g', k: 'oignons? rouges?|red onions?' },
  { n: 'RedMart Spring Onion', id: 'i1626076584-s7648749274', size: '125 g', k: 'oignons? verts?|spring onions?|cébettes?' },
  { n: 'Fragrant Shallots 200G', id: 'i1885994761-s10053335030', size: '200 g', k: 'échalotes?|shallots?' },
  { n: 'ThyGrace Yellow Onions', id: 'i303698031-s537374146', size: '500 g', k: 'oignons?|onions?' },
  { n: 'RedMart Organic Garlic', id: 'i304208852-s538406922', size: '200 g', k: '\\bail\\b(?! en poudre)|garlic(?! powder)' },
  { n: 'Old Ginger', id: 'i2124802203-s12059451664', size: '300 g', k: 'gingembre|ginger' },
  { n: 'Picard Sliced Leek - Frozen', id: 'i937436907-s3315096022', size: '1 kg', k: 'poireaux?|leeks?' },
  { n: 'Gold+ Australia Celery', id: 'i2353933232-s13731699846', size: '1 kg', k: 'céleri(?!-rave)|celery' },
  { n: 'MMMM! Parsnip', id: 'i13787592687-s124769037651', size: '180 g', k: 'panais|parsnips?' },
  { n: 'Spore Gardens Golden Oak Shiitake', id: 'i13719884521-s124659194193', size: '120 g', k: 'shiitak' },
  { n: 'Fungo Organic Brown Button Mushrooms', id: 'i303642477-s537290854', size: '200 g', k: 'champignons?|mushrooms?' },
  { n: 'Picard Mini Artichoke Hearts - Frozen', id: 'i2937868789-s20207639328', size: '300 g', k: 'artichauts?|artichokes?' },
  { n: 'Picard Sweet Baby Peas - Frozen', id: 'i2494458891-s15035244745', size: '1 kg', k: 'petits? pois|\\bpeas\\b' },
  { n: 'RedMart Sweet Corn 2s', id: 'i301108870-s527088996', size: '2', k: 'maïs|sweet ?corn|\\bcorn\\b' },
  { n: 'Australia Portion Cut Japanese Pumpkin', id: 'i3139386592-s21391243656', size: '1 kg', k: 'potiron|citrouille|pumpkin(?! seeds)' },
  { n: 'RedMart Italian Parsley', id: 'i2149941093-s12237663373', size: '50 g', k: 'persil(?! racine)|parsley(?! root)' },
  { n: 'Chinese Parsley Coriander', id: 'i301116013-s527126122', size: '50 g', k: 'coriandre|coriander' },
  { n: 'RedMart Thyme', id: 'i327242462-s692064632', size: '30 g', k: 'thym|thyme' }
];

/** Basics the family re-buys all the time (editable in the app). */
export const DEFAULT_STAPLES = ['Lait', 'Œufs', 'Farine', 'Peanut butter', 'Weet-Bix', 'Bananes', 'Salade'];
const STAPLE_EN: Record<string, string> = { Lait: 'Milk', 'Œufs': 'Eggs', Farine: 'Flour', Bananes: 'Bananas', Salade: 'Lettuce' };
export const stapleLabel = (name: string, lang: string) => (lang === 'fr' ? name : STAPLE_EN[name] || name);

const compiled = REDMART_PRODUCTS.map((p) => ({ p, re: new RegExp(`(?<![a-zà-ÿœ])(?:${p.k})`, 'i') }));

export function redmartMatch(text: string): RedmartProduct | null {
  const hit = compiled.find((c) => c.re.test(text));
  return hit ? hit.p : null;
}
export const redmartUrl = (p: RedmartProduct) => `https://www.lazada.sg/products/${p.id}.html`;
export const redmartSearchUrl = (q: string) => `https://www.lazada.sg/catalog/?q=${encodeURIComponent(q)}&m=redmart`;
