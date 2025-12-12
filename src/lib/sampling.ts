/**
 * Sampling strategies for polynomial iteration
 *
 * Provides different ways to select which polynomials to render,
 * enabling exploration of different "slices" of the Littlewood polynomial space.
 */

export type SamplingMode =
  | 'uniform'    // Current behavior: index * skipInterval + offset
  | 'first'      // First N polynomials (no skipping) + offset
  | 'random'     // Pseudo-random step increments
  | 'by_a0'      // Filter by free coefficient (a₀)
  | 'by_an';     // Filter by leading coefficient (aₙ)

export interface SamplingConfig {
  mode: SamplingMode;
  // For by_a0 and by_an modes: which coefficient index to filter by (0 to coeffsLength-1)
  filterCoeffIndex: number;
  // Normalized offset (0 to 1) for uniform and first modes
  offset: number;
}

export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  mode: 'uniform',
  filterCoeffIndex: 0,
  offset: 0,
};

/**
 * Pre-computed array of 997 prime numbers evenly distributed across 7 orders of magnitude.
 * Structure: 143 rows × 7 columns (last row truncated to get exactly 997 primes).
 * Each row contains primes from orders: 10², 10⁷, 10⁶, 10⁵, 10⁴, 10³, 10⁸.
 * Primes are evenly spaced within each order, then shuffled to avoid monotonic patterns.
 * Using a prime count (997) reduces aliasing patterns.
 */
const RANDOM_STEPS: number[] = [
  821, 36250003, 7375009, 131251, 79379, 5077, 900000011,
  809, 68125003, 1125001, 156253, 21269, 1319, 693750007,
  701, 50625007, 5437507, 112501, 25633, 6761, 331250033,
  211, 16875011, 2812519, 681251, 91253, 2203, 337500013,
  797, 19375007, 3437501, 968761, 96893, 4751, 675000037,
  907, 33750007, 4937509, 487507, 11887, 6317, 625000027,
  479, 34375007, 9750001, 562501, 53759, 5381, 850000013,
  733, 45000017, 7812521, 943751, 45007, 2633, 325000021,
  251, 67500007, 7875013, 362521, 63761, 7507, 918750037,
  719, 26250031, 9562507, 393761, 66271, 7639, 262500011,
  863, 18125017, 9250009, 200003, 40009, 7937, 643750027,
  281, 35625017, 3187507, 293767, 64381, 1063, 725000033,
  769, 14375059, 2062513, 300007, 29383, 6067, 856250077,
  191, 80625007, 8437519, 462529, 43753, 4201, 118750003,
  293, 15000017, 9500021, 262501, 83761, 5639, 718750001,
  743, 88125067, 3312503, 606251, 20627, 7321, 350000041,
  277, 51875003, 3062509, 537527, 87509, 8501, 631250003,
  457, 11875001, 5812517, 456283, 41257, 2251, 581250023,
  331, 37500007, 8562523, 725009, 63127, 2879, 218750011,
  887, 65625017, 2875001, 275003, 81281, 9001, 487500029,
  401, 25000009, 7750003, 356261, 50021, 3067, 987500011,
  739, 86875031, 3687557, 631259, 41879, 2377, 668750021,
  983, 50000017, 2312521, 850009, 75629, 5501, 406250041,
  653, 48125003, 4437523, 925019, 89381, 6563, 606250003,
  971, 68750021, 7312517, 931267, 36877, 8069, 737500007,
  107, 23750009, 2125001, 381253, 95629, 4813, 812500027,
  149, 54375031, 4562501, 781271, 22501, 6379, 781250137,
  431, 83125001, 8375009, 650011, 16253, 5003, 475000003,
  293, 91250011, 2000003, 912511, 72503, 8941, 256250011,
  709, 15625007, 6875023, 856277, 66877, 6947, 300000007,
  769, 93750023, 2250013, 887503, 39383, 8191, 175000039,
  127, 73125011, 2750021, 906259, 47501, 5813, 612500033,
  907, 13125001, 3937501, 137507, 49391, 7393, 562500013,
  967, 38750011, 5187503, 556253, 48131, 1877, 168750053,
  113, 46250003, 4250021, 775007, 35671, 5189, 818750003,
  211, 43125013, 8062501, 325001, 43133, 5437, 506250007,
  347, 30625009, 7437503, 587513, 38149, 4937, 768750007,
  521, 13750043, 4500007, 468761, 28751, 3251, 418750019,
  257, 96250003, 1437511, 900001, 73127, 8627, 937500001,
  937, 27500003, 4312501, 500009, 13751, 2063, 837500017,
  593, 28125001, 3625003, 175003, 31253, 6521, 362500007,
  379, 60625021, 7000003, 831253, 67511, 6449, 306250069,
  163, 29375041, 8937503, 750019, 86923, 7877, 993750001,
  223, 62500001, 8500007, 193751, 65629, 1439, 700000001,
  223, 35000011, 5875003, 162517, 90001, 5147, 731250011,
  673, 44375041, 5750047, 731251, 85009, 4001, 356250017,
  827, 55000013, 6937501, 150001, 60631, 8443, 443750003,
  239, 71875033, 8312501, 331259, 23753, 3571, 975000023,
  227, 51250007, 3812513, 231269, 98773, 3761, 862500019,
  577, 39375001, 1625017, 243769, 83137, 8377, 231250009,
  337, 25625029, 6750001, 581261, 97501, 5323, 956250013,
  587, 40625017, 2562503, 418751, 50627, 9437, 312500017,
  397, 80000023, 6687521, 450001, 10627, 9767, 887500037,
  373, 71250007, 9437579, 287501, 56891, 9187, 775000001,
  179, 75625001, 9812503, 812501, 27509, 8263, 968750011,
  701, 48750001, 3562511, 743777, 18127, 4127, 875000033,
  443, 63125009, 5500003, 950009, 31883, 3389, 225000011,
  631, 96875003, 8812537, 512503, 61253, 9257, 893750009,
  307, 76875023, 5312507, 600011, 16879, 7451, 293750011,
  431, 81875021, 4625021, 693757, 30631, 1627, 181250033,
  137, 21875033, 2375011, 318751, 24379, 6883, 706250033,
  563, 82500017, 1812509, 425003, 57503, 4073, 756250007,
  263, 49375009, 8625007, 637513, 98129, 2819, 712500007,
  151, 98125039, 9687523, 337511, 26251, 7753, 468750001,
  919, 40000003, 1562513, 881269, 69379, 2687, 237500069,
  503, 21250001, 7625003, 718759, 77509, 1381, 925000001,
  127, 56875009, 6062503, 493777, 95003, 4567, 662500019,
  877, 53125001, 6625001, 168761, 44381, 8753, 318750007,
  557, 28750019, 6125023, 987509, 62501, 8819, 287500009,
  521, 65000011, 9312547, 712507, 19379, 6689, 131250011,
  787, 91875001, 7687501, 893777, 33149, 6197, 112500071,
  157, 52500013, 9937511, 237509, 80021, 1567, 787500031,
  487, 95625011, 4187501, 825001, 56263, 7687, 412500029,
  991, 69375013, 9000011, 756251, 15629, 8009, 537500009,
  251, 66875023, 7500013, 550007, 53129, 7253, 843750023,
  853, 55625029, 7187503, 818813, 13127, 3187, 762500003,
  353, 43750013, 6000011, 443753, 78137, 2753, 575000011,
  367, 20625019, 4125013, 787513, 45631, 9587, 593750011,
  853, 12500003, 1250003, 212501, 42509, 1693, 425000033,
  331, 11250007, 2687521, 962503, 17509, 1187, 531250003,
  509, 53750009, 4750001, 475037, 84377, 6131, 600000001,
  439, 72500027, 1312513, 668761, 46261, 2333, 150000001,
  181, 60000011, 5562503, 643751, 73751, 8887, 250000013,
  953, 26875003, 6312521, 406253, 93131, 9883, 750000007,
  619, 31875029, 4687517, 768751, 96259, 8689, 943750001,
  757, 58750031, 6562519, 837503, 88771, 5779, 587500051,
  683, 57500017, 3750001, 762529, 58757, 5879, 793750007,
  977, 84375013, 6812513, 412537, 21881, 1259, 493750009,
  839, 86250001, 4875037, 593767, 68141, 8147, 187500007,
  997, 59375003, 7062511, 543769, 28151, 7817, 137500007,
  719, 64375001, 5937509, 250007, 76883, 2129, 512500013,
  691, 89375003, 1750009, 343769, 11251, 3877, 212500039,
  131, 46875011, 5062529, 700001, 54377, 4637, 550000001,
  787, 22500011, 6437521, 437501, 36251, 1129, 868750019,
  967, 77500063, 8187511, 187507, 20011, 9941, 825000019,
  947, 36875011, 1937513, 525001, 71879, 3137, 637500007,
  487, 76250003, 3375007, 531253, 58129, 9817, 462500057,
  569, 73750009, 1187507, 506251, 23131, 3943, 243750007,
  463, 18750001, 3250021, 868771, 71257, 9377, 931250027,
  613, 93125033, 4812503, 268757, 38767, 7001, 618750007,
  307, 66250027, 4000037, 687517, 81883, 9319, 437500013,
  557, 45625001, 6500003, 843757, 74377, 1949, 950000017,
  499, 41250031, 9625003, 937501, 55001, 9629, 281250001,
  677, 61250003, 9187517, 625007, 18757, 3511, 456250013,
  541, 94375009, 8875001, 281251, 93761, 1753, 681250021,
  881, 90000049, 8000009, 225023, 40627, 3001, 806250013,
  751, 98750021, 3125009, 975011, 85627, 9511, 143750021,
  673, 16250009, 3500017, 793757, 32503, 5261, 831250009,
  839, 20000003, 6250009, 256279, 78779, 5689, 343750007,
  419, 31250017, 1875007, 387503, 55631, 1511, 368750017,
  877, 70000027, 5250029, 662513, 75011, 9689, 518750003,
  857, 41875003, 3875041, 181253, 94379, 2437, 125000003,
  457, 81250019, 9062503, 481297, 90631, 7127, 275000051,
  269, 24375017, 8250013, 118751, 12503, 5563, 450000007,
  541, 10625003, 7937533, 375017, 51893, 3313, 656250029,
  409, 92500013, 8125009, 218761, 34381, 7069, 268750019,
  313, 17500013, 9125009, 875011, 26879, 5939, 106250047,
  919, 47500001, 5687501, 862501, 99377, 6007, 962500009,
  173, 75000007, 8687513, 706253, 86257, 4391, 375000013,
  787, 79375019, 6187501, 956261, 65003, 7573, 381250013,
  383, 42500023, 5625017, 918751, 70001, 6257, 206250019,
  643, 99375037, 5000011, 306253, 25013, 4327, 650000009,
  587, 74375011, 2187511, 806257, 80627, 4877, 393750001,
  193, 83750047, 5375003, 400009, 76253, 4253, 387500011,
  809, 90625001, 4375039, 350003, 46877, 3691, 500000003,
  641, 32500001, 7562519, 981263, 35023, 6637, 556250017,
  821, 33125009, 2437507, 106261, 37501, 2579, 881250011,
  359, 23125007, 7125037, 431251, 61879, 3631, 981250019,
  929, 78125041, 1687507, 143779, 52501, 4441, 906250013,
  907, 78750011, 2937509, 568751, 14387, 2503, 800000011,
  331, 63750019, 1375007, 675029, 92503, 4507, 200000033,
  419, 30000001, 4062521, 800011, 60013, 1823, 156250027,
  389, 97500061, 1062511, 618799, 48751, 7187, 431250037,
  541, 85625011, 1500007, 656263, 59377, 4691, 525000031,
  727, 58125007, 9875009, 737501, 33751, 6823, 481250027,
  631, 95000011, 5125009, 518759, 15013, 9127, 743750027,
  601, 70625011, 8750011, 368773, 68767, 9067, 912500009,
  547, 56250011, 7250011, 206251, 70627, 8563, 162500029,
  233, 38125049, 6375023, 312509, 30011, 2003, 400000009,
  937, 88750001, 2500009, 125003, 82507, 3821, 193750021,
  479, 61875013, 9375001, 993763, 51257, 8317, 687500003,
  659, 87500029, 3000017, 612511, 91909, 3449, 568750037,
  607, 85000007, 2625001,
];

// Pre-calculate average for normalization
const RANDOM_STEPS_SUM = RANDOM_STEPS.reduce((a, b) => a + b, 0);
const RANDOM_STEPS_AVG = RANDOM_STEPS_SUM / RANDOM_STEPS.length;
const RANDOM_STEPS_COUNT = RANDOM_STEPS.length;

/**
 * Get a normalized random step multiplier for a given iteration.
 * Returns a value that, on average, equals 1.0 over many iterations.
 */
export const getRandomStepMultiplier = (iteration: number): number => {
  return RANDOM_STEPS[iteration % RANDOM_STEPS_COUNT] / RANDOM_STEPS_AVG;
};

/**
 * Calculate polynomial index based on sampling mode.
 *
 * @param localIndex - The iteration counter (0, 1, 2, ...)
 * @param baseSkipInterval - The uniform skip interval
 * @param config - Sampling configuration
 * @param totalPolynomials - Total number of polynomials
 * @param coeffsLength - Number of coefficient choices
 * @param degree - Polynomial degree
 * @param maxRoots - Max roots to draw (used to calculate offset range)
 * @returns The actual polynomial index to render, or -1 to skip
 */
export const getPolynomialIndex = (
  localIndex: number,
  baseSkipInterval: number,
  config: SamplingConfig,
  totalPolynomials: number,
  coeffsLength: number,
  degree: number,
  maxRoots: number
): number => {
  // When maxRoots is unlimited, ignore sampling settings and use simple uniform
  if (!isFinite(maxRoots)) {
    return localIndex;
  }

  switch (config.mode) {
    case 'uniform': {
      // Offset shifts the starting point within the skip interval
      const startOffset = Math.floor(config.offset * Math.max(0, baseSkipInterval - 1));
      return startOffset + localIndex * baseSkipInterval;
    }

    case 'first': {
      // Offset shifts which "first N" polynomials to show
      const theoreticalMax = totalPolynomials;
      const polynomialsToRender = Math.ceil(maxRoots / degree);
      const maxOffset = Math.max(0, theoreticalMax - polynomialsToRender);
      const startOffset = Math.floor(config.offset * maxOffset);
      return startOffset + localIndex;
    }

    case 'random': {
      // Use base uniform position + pseudo-random offset
      // This maintains O(1) complexity while adding variation
      // The offset is deterministic (based on iteration) so results are reproducible
      const baseIndex = localIndex * baseSkipInterval;
      const multiplier = getRandomStepMultiplier(localIndex);
      // Normalize multiplier to range around 1, then apply wider spread
      // The large prime range (10² - 10⁶) creates significant variation
      const normalizedMultiplier = (multiplier - 1) * 0.8 + 1; // ±80% variation
      return Math.max(0, Math.floor(baseIndex * normalizedMultiplier));
    }

    case 'by_a0': {
      // Filter polynomials where index % coeffsLength == filterCoeffIndex
      // This selects polynomials with a specific free coefficient (a₀)
      const targetA0 = config.filterCoeffIndex % coeffsLength;
      // Direct calculation: polynomials with a₀ = targetA0 have indices:
      // targetA0, targetA0 + coeffsLength, targetA0 + 2*coeffsLength, ...
      const filteredIndex = targetA0 + (localIndex * baseSkipInterval) * coeffsLength;
      return filteredIndex < totalPolynomials ? filteredIndex : -1;
    }

    case 'by_an': {
      // Filter polynomials where floor(index / coeffsLength^degree) % coeffsLength == filterCoeffIndex
      // This selects polynomials with a specific leading coefficient (aₙ)
      const targetAn = config.filterCoeffIndex % coeffsLength;
      const highOrderBase = Math.pow(coeffsLength, degree);
      // Polynomials with aₙ = targetAn start at targetAn * highOrderBase
      // and span highOrderBase consecutive indices
      const blockStart = targetAn * highOrderBase;
      const indexInBlock = localIndex * baseSkipInterval;
      if (indexInBlock >= highOrderBase) return -1;
      return blockStart + indexInBlock;
    }

    default:
      return localIndex * baseSkipInterval;
  }
};

/**
 * Calculate total polynomials that will be rendered for a given sampling config.
 * Used for progress calculation and color distribution.
 */
export const getEffectivePolynomialCount = (
  totalPolynomials: number,
  maxRoots: number,
  degree: number,
  config: SamplingConfig,
  coeffsLength: number
): number => {
  const baseCount = Math.min(
    totalPolynomials,
    maxRoots === Infinity ? totalPolynomials : Math.ceil(maxRoots / degree)
  );

  switch (config.mode) {
    case 'uniform':
    case 'random':
    case 'first':
      return baseCount;

    case 'by_a0':
      // Only 1/coeffsLength of polynomials match
      return Math.ceil(baseCount / coeffsLength);

    case 'by_an':
      // Only 1/coeffsLength of polynomials match (in a contiguous block)
      return Math.min(baseCount, Math.pow(coeffsLength, degree));

    default:
      return baseCount;
  }
};
