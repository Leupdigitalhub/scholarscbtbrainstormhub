// Curated SS1–SS3 / JAMB-style question bank. Each row: [question, [A,B,C,D], correctLetter, explanation]
type Row = [string, [string, string, string, string], "A" | "B" | "C" | "D", string];

export const MASTER_BANK: Record<string, Row[]> = {
  English: [
    ["Choose the word nearest in meaning to the underlined word: The manager was very *candid* about the losses.", ["secretive", "frank", "angry", "careless"], "B", "Candid means open and honest. 'Frank' carries the same meaning; the others do not."],
    ["Choose the word opposite in meaning to: The soldier's behaviour was *cowardly*.", ["timid", "brave", "lazy", "foolish"], "B", "Cowardly means lacking courage, so its opposite is brave."],
    ["Fill the gap: Neither the teacher nor the students ___ in the hall.", ["was", "is", "were", "has been"], "C", "With 'neither…nor', the verb agrees with the nearer subject. 'Students' is plural, so we use 'were'."],
    ["Choose the correctly spelt word.", ["Accomodation", "Accommodation", "Acommodation", "Accommadation"], "B", "Accommodation has double 'c' and double 'm': ac-com-mo-da-tion."],
    ["Fill the gap: He has been living here ___ 2015.", ["for", "since", "from", "at"], "B", "'Since' is used with a point in time (2015); 'for' is used with a length of time (e.g. for ten years)."],
    ["Which word has the same vowel sound as 'seat'?", ["sit", "set", "key", "sat"], "C", "'Seat' has the long /iː/ sound, the same as 'key'. 'Sit' has the short /ɪ/ sound."],
    ["The idiom 'to bury the hatchet' means to ___", ["start a fight", "make peace", "hide a weapon", "dig a grave"], "B", "To bury the hatchet means to end a quarrel and become friendly again."],
    ["Fill the gap: If I ___ you, I would apologise.", ["am", "was", "were", "be"], "C", "In hypothetical (unreal) conditionals, 'were' is used for all persons: 'If I were you…'."],
    ["Choose the option that best completes: The book is ___ than the one I bought last week.", ["more interesting", "most interesting", "interestinger", "much interesting"], "A", "We compare two things, so use the comparative form. Long adjectives take 'more': 'more interesting'."],
    ["Identify the part of speech of 'quickly' in: She ran quickly to school.", ["adjective", "noun", "adverb", "preposition"], "C", "'Quickly' describes how she ran (the verb), so it is an adverb."],
  ],
  Mathematics: [
    ["Simplify: 2x + 3x − x", ["4x", "5x", "6x", "3x"], "A", "Combine like terms: 2x + 3x = 5x, then 5x − x = 4x."],
    ["Solve for x: 3x − 7 = 11", ["4", "6", "5", "18"], "B", "Add 7 to both sides: 3x = 18. Divide by 3: x = 6."],
    ["Find the value of 2³ × 2²", ["16", "32", "64", "10"], "B", "Add the powers when multiplying the same base: 2³ × 2² = 2⁵ = 32."],
    ["What is the area of a circle of radius 7 cm? (π = 22/7)", ["44 cm²", "154 cm²", "49 cm²", "308 cm²"], "B", "Area = πr² = (22/7) × 7 × 7 = 22 × 7 = 154 cm²."],
    ["Convert 1011₂ to base ten.", ["9", "10", "11", "13"], "C", "1011₂ = 1×8 + 0×4 + 1×2 + 1×1 = 8 + 0 + 2 + 1 = 11."],
    ["Find the gradient of the line joining (1, 2) and (3, 8).", ["2", "3", "4", "6"], "B", "Gradient = (y₂ − y₁)/(x₂ − x₁) = (8 − 2)/(3 − 1) = 6/2 = 3."],
    ["Factorise: x² − 9", ["(x − 3)²", "(x + 3)(x − 3)", "(x + 9)(x − 1)", "x(x − 9)"], "B", "This is a difference of two squares: a² − b² = (a + b)(a − b), so x² − 3² = (x + 3)(x − 3)."],
    ["The mean of 4, 6, 8, 10 and 12 is", ["6", "8", "9", "10"], "B", "Sum = 4 + 6 + 8 + 10 + 12 = 40. Mean = 40 ÷ 5 = 8."],
    ["Evaluate log₁₀ 1000", ["2", "3", "10", "100"], "B", "10³ = 1000, so log₁₀ 1000 = 3."],
    ["A fair die is thrown once. What is the probability of getting an even number?", ["1/6", "1/3", "1/2", "2/3"], "C", "Even numbers are 2, 4, 6: three outcomes out of six. 3/6 = 1/2."],
  ],
  Physics: [
    ["The SI unit of force is the", ["Joule", "Newton", "Watt", "Pascal"], "B", "Force is measured in newtons (N). 1 N = 1 kg·m/s²."],
    ["A car travels 120 m in 6 s. Its average speed is", ["20 m/s", "720 m/s", "12 m/s", "60 m/s"], "A", "Speed = distance ÷ time = 120 ÷ 6 = 20 m/s."],
    ["Which of these is a vector quantity?", ["Mass", "Speed", "Velocity", "Temperature"], "C", "Velocity has both size and direction, so it is a vector. The others have size only (scalars)."],
    ["The acceleration due to gravity near the Earth's surface is about", ["1 m/s²", "5 m/s²", "10 m/s²", "100 m/s²"], "C", "g ≈ 9.8 m/s², usually rounded to 10 m/s² in calculations."],
    ["Calculate the work done when a force of 50 N moves a body 4 m in its direction.", ["12.5 J", "54 J", "200 J", "46 J"], "C", "Work = force × distance = 50 × 4 = 200 J."],
    ["Ohm's law states that V =", ["I/R", "IR", "R/I", "I + R"], "B", "Voltage equals current multiplied by resistance: V = IR."],
    ["The resistance of a wire is 6 Ω and the current is 2 A. The voltage is", ["3 V", "8 V", "12 V", "4 V"], "C", "V = IR = 2 × 6 = 12 V."],
    ["Sound cannot travel through", ["water", "steel", "air", "a vacuum"], "D", "Sound needs particles to vibrate. A vacuum has no particles, so sound cannot pass through it."],
    ["The kinetic energy of a 2 kg body moving at 3 m/s is", ["3 J", "6 J", "9 J", "18 J"], "C", "KE = ½mv² = ½ × 2 × 3² = 1 × 9 = 9 J."],
    ["Which colour of visible light has the longest wavelength?", ["Violet", "Blue", "Green", "Red"], "D", "In the visible spectrum, red has the longest wavelength and violet the shortest."],
  ],
  Chemistry: [
    ["The atomic number of an element is the number of", ["neutrons", "protons", "electrons and neutrons", "nucleons"], "B", "Atomic number (Z) is the number of protons in the nucleus of an atom."],
    ["Which of these is a noble gas?", ["Oxygen", "Nitrogen", "Argon", "Chlorine"], "C", "Argon is in Group 0 (18), the noble gases, which are very unreactive."],
    ["The chemical formula of common salt is", ["NaCl", "KCl", "CaCO₃", "NaOH"], "A", "Common (table) salt is sodium chloride, NaCl."],
    ["A solution with pH 2 is", ["strongly alkaline", "neutral", "weakly alkaline", "strongly acidic"], "D", "pH below 7 is acidic; the lower the value, the stronger the acid. pH 2 is strongly acidic."],
    ["How many moles are in 44 g of CO₂? (C = 12, O = 16)", ["0.5", "1", "2", "44"], "B", "Molar mass of CO₂ = 12 + 2×16 = 44 g/mol. Moles = 44 ÷ 44 = 1 mol."],
    ["The bond formed by sharing electrons is", ["ionic", "covalent", "metallic", "hydrogen"], "B", "A covalent bond is formed when atoms share pairs of electrons."],
    ["Rusting of iron requires", ["oxygen only", "water only", "oxygen and water", "carbon dioxide"], "C", "Iron rusts only when both oxygen (air) and water are present."],
    ["The gas that turns lime water milky is", ["O₂", "H₂", "CO₂", "N₂"], "C", "Carbon dioxide reacts with lime water (Ca(OH)₂) to form insoluble CaCO₃, making it milky."],
    ["Which process separates a mixture of salt and water to recover the salt?", ["Filtration", "Evaporation", "Decantation", "Sublimation"], "B", "Salt is dissolved, so filtering won't work. Evaporating the water leaves the salt behind."],
    ["The general formula of alkanes is", ["CₙH₂ₙ", "CₙH₂ₙ₊₂", "CₙH₂ₙ₋₂", "CₙHₙ"], "B", "Alkanes are saturated hydrocarbons with formula CₙH₂ₙ₊₂ (e.g. methane CH₄, n = 1)."],
  ],
  Biology: [
    ["The basic unit of life is the", ["tissue", "organ", "cell", "organism"], "C", "The cell is the smallest structural and functional unit of all living things."],
    ["Photosynthesis takes place mainly in the", ["roots", "chloroplasts", "mitochondria", "nucleus"], "B", "Chloroplasts contain chlorophyll, which traps light energy for photosynthesis."],
    ["Which blood cells fight infection?", ["Red blood cells", "White blood cells", "Platelets", "Plasma"], "B", "White blood cells (leucocytes) defend the body by engulfing germs and making antibodies."],
    ["The powerhouse of the cell is the", ["ribosome", "nucleus", "mitochondrion", "vacuole"], "C", "Mitochondria carry out aerobic respiration, releasing energy (ATP) for the cell."],
    ["Which organ produces insulin?", ["Liver", "Pancreas", "Kidney", "Stomach"], "B", "Insulin is made by the islets of Langerhans in the pancreas and lowers blood sugar."],
    ["The malaria parasite is transmitted by the female", ["Aedes mosquito", "Culex mosquito", "Anopheles mosquito", "housefly"], "C", "Plasmodium, which causes malaria, is carried by the female Anopheles mosquito."],
    ["In genetics, an organism with genotype Tt is described as", ["homozygous dominant", "heterozygous", "homozygous recessive", "a mutant"], "B", "Tt has two different alleles, so it is heterozygous."],
    ["Which of these is a vertebrate?", ["Earthworm", "Snail", "Frog", "Cockroach"], "C", "A frog has a backbone (vertebral column); the others are invertebrates."],
    ["The functional unit of the kidney is the", ["neuron", "nephron", "alveolus", "villus"], "B", "Each kidney contains about a million nephrons that filter the blood and form urine."],
    ["Gaseous exchange in humans takes place in the", ["trachea", "bronchi", "alveoli", "larynx"], "C", "Alveoli are tiny air sacs with thin walls and many capillaries where O₂ and CO₂ are exchanged."],
  ],
};

export const BANK_SUBJECTS = Object.keys(MASTER_BANK);
export const BANK_SIZE = Object.values(MASTER_BANK).reduce((n, r) => n + r.length, 0);
