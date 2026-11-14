// Family health profiles, shown on every device at the family's request.
// Criteria come from Bap's blood tests and food-intolerance panel, and Leah's iron needs.
import type { HealthProfile } from './health';

export const FAMILY_PROFILES: HealthProfile[] = [
  {
    "id": "bap",
    "name": "Bap",
    "emoji": "🧑‍🍳",
    "goals": {
      "lowSatFat": true,
      "highFibre": true,
      "omega3": true,
      "legumes": true,
      "lowSugar": true,
      "lowRefined": true,
      "lowSalt": true
    },
    "avoid": [
      {
        "label": "gluten (blé, pâtes, pain, semoule…)",
        "re": "(farine|flour)(?! de (riz|maïs|mais|sarrasin|coco|pois|châtaigne|amande))|(^|[^a-zà-ÿ])blé(?![a-zà-ÿ])|froment|semoule|couscous|boulgour|bulgur|\\borge\\b|seigle|\\brye\\b|barley|(pâtes|pasta|spaghetti|tagliatelle|penne|coquillettes?|conchiglion|gigli|macaroni|nouilles|noodles|lasagne)(?![^,]*sans gluten)|\\bpain\\b|bread|baguette|brioche|pita|naan|tortillas?(?! de maïs)|chapelure|breadcrumbs|panko|sauce soja(?! sans gluten)|soy sauce|pâte (?:feuilletée|brisée)|puff pastry|biscuits?"
      },
      {
        "label": "lait de vache / caséine",
        "re": "\\blait\\b(?! de (coco|soja|riz|amande|avoine))|\\bmilk\\b(?! \\()|beurre(?! de cacahu| d.amande)|\\bbutter\\b|crème(?! de coco)|\\bcream\\b(?! of)|fromage(?! de chèvre)|cheese|parmesan|mozzarella|gruy[eè]re|emmental|comté|cheddar|ricotta|mascarpone|yaourt|yog(h)?urt|burrata|halloumi"
      },
      {
        "label": "blanc d'œuf",
        "re": "(blancs? d'?(œ|oe)ufs?|egg whites?)|(^|[^a-zà-ÿ])(œufs?|oeufs?|eggs?)(?![a-zà-ÿ])(?![^,]*jaunes?)"
      },
      {
        "label": "lait / fromage de chèvre",
        "re": "chèvre|goat"
      },
      {
        "label": "haricots blancs",
        "re": "haricots? blancs?|cannellini|white beans?|haricot beans"
      },
      {
        "label": "petits pois",
        "re": "petits? pois|\\bpeas\\b"
      },
      {
        "label": "chou blanc / frisé",
        "re": "\\bchou\\b(?![- ]fleur|x de bruxelles)|cabbage"
      },
      {
        "label": "noisettes",
        "re": "noisettes?|hazelnuts?"
      },
      {
        "label": "levure de bière",
        "re": "levure de bière|levure de boulanger|brewer|nutritional yeast|bière|\\bbeer\\b"
      },
      {
        "label": "moules",
        "re": "moules?|mussels?"
      },
      {
        "label": "courge butternut",
        "re": "butternut|courge|squash"
      },
      {
        "label": "églefin (haddock)",
        "re": "églefin|haddock"
      },
      {
        "label": "pistaches",
        "re": "pistaches?|pistachios?"
      },
      {
        "label": "amarante",
        "re": "amarante|amaranth"
      }
    ],
    "limit": [
      {
        "label": "champignons",
        "re": "champignons?|mushrooms?"
      },
      {
        "label": "malt",
        "re": "\\bmalt"
      },
      {
        "label": "lait / fromage de brebis",
        "re": "brebis|feta|roquefort|pecorino|manchego|sheep"
      },
      {
        "label": "orange",
        "re": "\\boranges?\\b"
      },
      {
        "label": "prunes",
        "re": "prunes?|pruneaux|plums?"
      },
      {
        "label": "noix du Brésil",
        "re": "noix du brésil|brazil nuts?"
      }
    ]
  },
  {
    "id": "leah",
    "name": "Leah",
    "emoji": "👩‍🍳",
    "goals": {
      "iron": true,
      "highFibre": true,
      "lowSugar": true
    }
  }
];
