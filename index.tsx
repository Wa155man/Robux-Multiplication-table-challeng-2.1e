import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// ============================================================================
// TYPES
// ============================================================================
type GameState = 'selecting_difficulty' | 'playing' | 'won';

enum Difficulty {
  Easy = 'Easy',
  Moderate = 'Moderate',
  Hard = 'Hard',
}

enum Language {
  English = 'English',
  Hebrew = 'Hebrew',
  Russian = 'Russian',
}

interface Question {
  num1: number;
  num2: number;
  answer: number;
  options: number[];
}

// ============================================================================
// NATIVE BROWSER AUDIO SYSTEM (Web Speech API)
// ============================================================================

// Helper to load voices asynchronously (Chrome sometimes returns empty array initially)
const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      resolve(voices);
    };
  });
};

const speakText = async (text: string, language: Language) => {
  if (!('speechSynthesis' in window)) {
    console.warn('Web Speech API not supported.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const voices = await getVoices();
  const utterance = new SpeechSynthesisUtterance(text);

  // Default settings
  let selectedVoice: SpeechSynthesisVoice | undefined;
  let pitch = 1.0;
  let rate = 1.0;

  switch (language) {
    case Language.Hebrew:
      utterance.lang = 'he-IL';
      
      const heVoices = voices.filter(v => v.lang === 'he-IL' || v.lang === 'he');

      // 1. Try to find high quality female voices (Google, Microsoft Hoda, Apple)
      // These voices are usually natural and don't need tuning.
      const preferredHeNames = ["Google", "Hoda", "Carmit", "Sivan"];
      selectedVoice = heVoices.find(v => preferredHeNames.some(name => v.name.includes(name)));

      // 2. Fallback logic
      if (!selectedVoice && heVoices.length > 0) {
         selectedVoice = heVoices[0];
         
         // If we are likely on a robotic male system voice (e.g. Microsoft David), 
         // tune it to be "rounder" and "softer".
         pitch = 0.9; // Slightly deeper/rounder
         rate = 0.85; // Slower/Softer to reduce robotic clipping
      }
      
      utterance.voice = selectedVoice || null;
      break;

    case Language.Russian:
      utterance.lang = 'ru-RU';
      const ruVoices = voices.filter(v => v.lang === 'ru-RU' || v.lang === 'ru');
      selectedVoice = ruVoices.find(v => v.name.includes("Google")) || ruVoices[0];
      utterance.voice = selectedVoice || null;
      break;

    case Language.English:
    default:
      utterance.lang = 'en-US';
      const enVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Priority: Google Female -> OS Female -> First available
      const preferredEnNames = ["Google US English", "Samantha", "Zira", "Eva"];
      selectedVoice = enVoices.find(v => preferredEnNames.some(name => v.name.includes(name)));
      
      if (!selectedVoice && enVoices.length > 0) {
          selectedVoice = enVoices[0];
          // If we are stuck with a generic voice (often robotic male "David" on Windows), tune it
          if (selectedVoice.name.toLowerCase().includes("david") || selectedVoice.name.toLowerCase().includes("desktop")) {
               pitch = 0.9; // Rounder
               rate = 0.9;  // Softer
          }
      }
      
      utterance.voice = selectedVoice || null;
      break;
  }

  utterance.pitch = pitch;
  utterance.rate = rate;

  window.speechSynthesis.speak(utterance);
};

// ============================================================================
// ICONS
// ============================================================================
const RobuxIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="url(#paint0_linear_1_2)"/>
    <path d="M12 5L15 9H9L12 5Z" fill="white"/>
    <path d="M12 19L9 15H15L12 19Z" fill="white"/>
    <path d="M5 12L9 15V9L5 12Z" fill="white"/>
    <path d="M19 12L15 9V15L19 12Z" fill="white"/>
    <defs>
      <linearGradient id="paint0_linear_1_2" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FBBF24"/>
        <stop offset="1" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>
  </svg>
);

const FireIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 3.14001C13.5 3.14001 16.64 5.59001 15.63 9.30001C17.95 10.24 19.05 12.99 18.22 15.36C17.26 18.13 14.26 19.61 11.49 18.65C10.74 18.39 10.09 17.96 9.56001 17.42C9.03001 17.98 8.30001 18.34 7.49001 18.34C5.83001 18.34 4.49001 17 4.49001 15.34C4.49001 14.23 5.09001 13.24 6.00001 12.71C5.85001 12.03 5.98001 11.29 6.46001 10.73C7.76001 9.21001 10.05 9.03001 11.57 10.33C11.81 10.54 12.01 10.78 12.17 11.04C11.65 7.17001 13.5 3.14001 13.5 3.14001Z" fill="#F97316"/>
        <path d="M12.5 6C12.5 6 13.5 8 12.5 10C14 11 15 13 14 15C13.5 16 12 16.5 11 16C11.5 14.5 10.5 13.5 10 13.5C10.5 11.5 12.5 6 12.5 6Z" fill="#FDBA74"/>
    </svg>
);

const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor"/>
    </svg>
);

// ============================================================================
// VICTORY SCREEN
// ============================================================================
interface VictoryScreenProps {
  onPlayAgain: () => void;
}

const VictoryScreen: React.FC<VictoryScreenProps> = ({ onPlayAgain }) => {
  const fireworks = Array.from({ length: 30 });
  const confetti = Array.from({ length: 60 });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-md overflow-hidden">
      
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {fireworks.map((_, i) => (
          <div
            key={`firework-${i}`}
            className="firework"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2.5}s`,
            }}
          />
        ))}
        {confetti.map((_, i) => (
          <div
            key={`confetti-${i}`}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: ['#fbbd23', '#ef4444', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 4)],
              animationDuration: `${Math.random() * 3 + 4}s`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative bg-gradient-to-br from-yellow-300 to-amber-500 p-8 md:p-12 m-4 rounded-2xl shadow-2xl text-center text-gray-800 max-w-2xl w-full border-8 border-yellow-500"
           style={{ textShadow: '2px 2px #ffffffaa' }}>
        <div className="flex justify-center mb-6 animate-bounce">
            <RobuxIcon className="w-24 h-24 text-white drop-shadow-lg" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">Congratulations!</h1>
        <p className="text-2xl md:text-3xl mb-8">
          You won 1000 Robux! Go to your parents to collect the gift!
        </p>
        <button
          onClick={() => {
              onPlayAgain();
          }}
          className="bg-green-500 text-white text-2xl font-bold py-4 px-10 rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300"
          style={{ 
            border: '4px solid black',
            boxShadow: '6px 6px 0px #000000'
          }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// DIFFICULTY SELECTOR
// ============================================================================
interface DifficultySelectorProps {
  onSelectDifficulty: (difficulty: Difficulty) => void;
  selectedLanguage: Language;
  onSelectLanguage: (language: Language) => void;
}

const DifficultySelector: React.FC<DifficultySelectorProps> = ({ onSelectDifficulty, selectedLanguage, onSelectLanguage }) => {
  
  const difficultyLabels: Record<Language, Record<Difficulty, string>> = {
    [Language.English]: {
      [Difficulty.Easy]: 'Super Easy',
      [Difficulty.Moderate]: 'Easy',
      [Difficulty.Hard]: 'Normal',
    },
    [Language.Hebrew]: {
      [Difficulty.Easy]: 'קל מאוד',
      [Difficulty.Moderate]: 'קל',
      [Difficulty.Hard]: 'רגיל',
    },
    [Language.Russian]: {
      [Difficulty.Easy]: 'Супер легко',
      [Difficulty.Moderate]: 'Легко',
      [Difficulty.Hard]: 'Нормально',
    },
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black bg-opacity-50 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
      <h1 className="text-3xl md:text-5xl text-white font-bold mb-6 text-center" style={{ textShadow: '4px 4px #000000' }}>
        Choose Your Challenge!
      </h1>

      <div className="mb-8 w-full max-w-4xl">
        <h2 className="text-xl md:text-2xl text-white font-bold mb-4 text-center" style={{ textShadow: '2px 2px #000000' }}>Language</h2>
        <div className="flex justify-center gap-4 flex-wrap">
          {(Object.values(Language) as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => onSelectLanguage(lang)}
              className={`text-white text-lg font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none ${selectedLanguage === lang ? 'ring-4 ring-yellow-400 scale-105' : 'focus:ring-2 focus:ring-gray-400'}`}
              style={{
                backgroundColor: '#4a5568',
                border: '2px solid black',
                boxShadow: '4px 4px 0px #000000'
              }}
            >
              {lang === Language.Hebrew ? 'עברית' : lang === Language.Russian ? 'Русский' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {(Object.keys(Difficulty) as Array<keyof typeof Difficulty>).map((key) => (
          <button
            key={key}
            onClick={() => {
                onSelectDifficulty(Difficulty[key]);
            }}
            className="text-white text-2xl font-bold py-8 px-6 rounded-lg shadow-xl transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-yellow-300"
            style={{
              backgroundColor: key === 'Easy' ? '#22c55e' : key === 'Moderate' ? '#f59e0b' : '#ef4444',
              border: '4px solid black',
              boxShadow: '8px 8px 0px #000000'
            }}
          >
            {difficultyLabels[selectedLanguage][Difficulty[key]]}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// GAME SCREEN
// ============================================================================
interface GameScreenProps {
  difficulty: Difficulty;
  language: Language;
  robuxScore: number;
  setRobuxScore: React.Dispatch<React.SetStateAction<number>>;
  setGameState: (state: 'won') => void;
}

const COMPLIMENTS = ['Good!', 'Excellent!', 'Great job!', 'You are doing well!', 'You are amazing!'];
const HIGH_SCORE_COMPLIMENTS = ["You are almost there!", "Keep up the good work!", "You are going to win soon!", "You are so smart!"];

const getPenalty = (score: number): number => {
    if (score >= 930) {
        return 8;
    }
    if (score >= 800) {
        return 5;
    }
    if (score >= 700) {
        return 4;
    }
    return 2; // Default penalty
};

const GameScreen: React.FC<GameScreenProps> = ({ difficulty, language, robuxScore, setRobuxScore, setGameState }) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [feedback, setFeedback] = useState<{ incorrectSelection?: number }>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState(0);
  const [showIntroMessage, setShowIntroMessage] = useState(true);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [lastQuestion, setLastQuestion] = useState<{ num1: number, num2: number } | null>(null);
  
  useEffect(() => {
    if(robuxScore >= 1000) {
      setGameState('won');
    }
  }, [robuxScore, setGameState]);

  useEffect(() => {
    switch (difficulty) {
      case Difficulty.Easy:
        setDifficultyLevel(0);
        break;
      case Difficulty.Moderate:
        setDifficultyLevel(2);
        break;
      case Difficulty.Hard:
        setDifficultyLevel(5);
        break;
    }
    setCorrectAnswersCount(0);
    setCorrectStreak(0);
    setWrongStreak(0);
  }, [difficulty]);
  
  useEffect(() => {
    if (wrongStreak > 0 && wrongStreak % 3 === 0) { // Every 3 consecutive wrong answers
        setDifficultyLevel(level => Math.max(0, level - 1));
    }
  }, [wrongStreak]);

  const generateQuestion = useCallback(() => {
    let num1: number, num2: number;
    let isRepeated;

    do {
      // Priority 1: High score difficulty override
      if (robuxScore >= 800) {
        const highFactors = [6, 7, 8, 9];
        num1 = highFactors[Math.floor(Math.random() * highFactors.length)];
        num2 = Math.floor(Math.random() * 7) + 6; // Other number is between 6 and 12
        if (Math.random() < 0.5) { // Swap for variety
          [num1, num2] = [num2, num1];
        }
      } 
      // Priority 2: Initial difficulty settings
      else if (difficulty === Difficulty.Hard) {
        // Both multipliers are bigger than 5 (i.e., 6, 7, 8, 9)
        const factors = [6, 7, 8, 9];
        num1 = factors[Math.floor(Math.random() * factors.length)];
        num2 = factors[Math.floor(Math.random() * factors.length)];
      }
      else if (difficulty === Difficulty.Moderate) {
        // One multiplier is from 4, 5, 6, 7
        const factors = [4, 5, 6, 7];
        num1 = factors[Math.floor(Math.random() * factors.length)];
        num2 = Math.floor(Math.random() * 10) + 1; 
        if (Math.random() < 0.5) { // Swap for variety
          [num1, num2] = [num2, num1];
        }
      }
      // Priority 3: Default dynamic difficulty for Easy and progression
      else if (difficulty === Difficulty.Easy && correctAnswersCount < 30) {
          const factor1 = Math.random() < 0.5 ? 2 : 3;
          const factor2 = Math.floor(Math.random() * 10) + 1;
          if (Math.random() > 0.5) {
              num1 = factor1;
              num2 = factor2;
          } else {
              num1 = factor2;
              num2 = factor1;
          }
      } else {
          // Fallback / standard dynamic difficulty progression
          let baseMaxNum = difficulty === Difficulty.Easy ? 4 : (difficulty === Difficulty.Moderate ? 7 : 10);
          const streakBonus = Math.floor(correctStreak / 3);
          const robuxBonus = robuxScore >= 500 ? 2 : 0;
          const effectiveLevel = difficultyLevel + streakBonus + robuxBonus;
          const maxNum1 = baseMaxNum + effectiveLevel;
          const maxNum2 = baseMaxNum + Math.max(0, effectiveLevel - 2);
          num1 = Math.floor(Math.random() * maxNum1) + 1;
          num2 = Math.floor(Math.random() * maxNum2) + 1;
          if (num1 === 1 && num2 === 1) {
              num2 = Math.floor(Math.random() * 9) + 2;
          }
      }

      // NEW RULE: No multiplication by 1 if score >= 100
      if (robuxScore >= 100) {
        if (num1 === 1) num1 = Math.floor(Math.random() * 3) + 2; // Replace with 2, 3, or 4
        if (num2 === 1) num2 = Math.floor(Math.random() * 3) + 2; // Replace with 2, 3, or 4
      }

      isRepeated = lastQuestion && ((num1 === lastQuestion.num1 && num2 === lastQuestion.num2) || (num1 === lastQuestion.num2 && num2 === lastQuestion.num1));
    } while (isRepeated);
    
    setLastQuestion({ num1, num2 });

    const answer = num1 * num2;
    const options: Set<number> = new Set([answer]);
    while (options.size < 4) {
      const wrongAnswerOffset = Math.floor(Math.random() * 10) - 5;
      const wrongAnswerMultiplier = Math.random() > 0.5 ? num1 : num2;
      let wrongAnswer = answer + wrongAnswerOffset * wrongAnswerMultiplier;
      if(wrongAnswer === answer || wrongAnswer <= 0){
        wrongAnswer = answer + (options.size * (Math.random() > 0.5 ? 1 : -1) * (Math.ceil(Math.random()*3) + 1));
        if (wrongAnswer <= 0 || wrongAnswer === answer) wrongAnswer = answer + options.size + 1;
      }
      options.add(wrongAnswer);
    }
    const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
    
    let questionText: string;
    switch (language) {
      case Language.Hebrew:
        questionText = `${num1} כפול ${num2}`;
        break;
      case Language.Russian:
        questionText = `${num1} умножить на ${num2}`;
        break;
      case Language.English:
      default:
        questionText = `${num1} times ${num2}`;
        break;
    }
    
    // Update the UI immediately
    setCurrentQuestion({ num1, num2, answer, options: shuffledOptions });
    setIsAnswered(false);
    setFeedback({});
    
    // Speak question using browser native API
    speakText(questionText, language);

  }, [difficulty, language, correctAnswersCount, correctStreak, robuxScore, difficultyLevel, lastQuestion]);
  
  // This function is triggered by the user clicking "START"
  const handleStartGame = () => {
      setShowIntroMessage(false);
      generateQuestion();
  };

  const handleAnswer = useCallback((selectedOption: number) => {
    if (isAnswered) return;

    setIsAnswered(true);
    
    // Stop reading question
    window.speechSynthesis.cancel();

    if (selectedOption === currentQuestion?.answer) {
      setRobuxScore(score => score + 5);
      setCorrectStreak(streak => streak + 1);
      setCorrectAnswersCount(count => count + 1);
      setWrongStreak(0);
      setFeedback({});
      const complimentArray = robuxScore >= 950 ? HIGH_SCORE_COMPLIMENTS : COMPLIMENTS;
      const randomCompliment = complimentArray[Math.floor(Math.random() * complimentArray.length)];
      
      // ALWAYS use English voice for compliments to ensure high-quality female voice
      // even if the game is in Hebrew mode.
      speakText(randomCompliment, Language.English);

    } else {
      const penalty = getPenalty(robuxScore);
      setRobuxScore(score => Math.max(0, score - penalty));
      setCorrectStreak(0);
      setWrongStreak(streak => streak + 1);
      setFeedback({ incorrectSelection: selectedOption });
    }
    
    setTimeout(() => {
      generateQuestion();
    }, 1250);
  }, [isAnswered, currentQuestion, setRobuxScore, generateQuestion, robuxScore, language]);

  const handleTypedAnswerSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isAnswered || !typedAnswer.trim()) return;
    
    setIsAnswered(true);
    window.speechSynthesis.cancel(); // Stop question

    const userAnswer = parseInt(typedAnswer, 10);

    if (userAnswer === currentQuestion?.answer) {
        setRobuxScore(score => score + 5);
        setCorrectStreak(streak => streak + 1);
        setCorrectAnswersCount(count => count + 1);
        setWrongStreak(0);
        setFeedback({});
        const complimentArray = robuxScore >= 950 ? HIGH_SCORE_COMPLIMENTS : COMPLIMENTS;
        const randomCompliment = complimentArray[Math.floor(Math.random() * complimentArray.length)];
        
        // ALWAYS use English voice for compliments to ensure high-quality female voice
        speakText(randomCompliment, Language.English);

    } else {
        const penalty = getPenalty(robuxScore);
        setRobuxScore(score => Math.max(0, score - penalty));
        setCorrectStreak(0);
        setWrongStreak(streak => streak + 1);
        setFeedback({ incorrectSelection: userAnswer });
    }

    setTimeout(() => {
        setTypedAnswer('');
        generateQuestion();
    }, 1250);
  }, [isAnswered, typedAnswer, currentQuestion, setRobuxScore, generateQuestion, robuxScore, language]);


  if (showIntroMessage) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
            
            {/* Floating Robux Background Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="absolute opacity-30 animate-pulse" 
                         style={{
                             top: `${Math.random() * 100}%`,
                             left: `${Math.random() * 100}%`,
                             animationDuration: `${2 + Math.random() * 3}s`
                         }}>
                         <RobuxIcon className="w-12 h-12 md:w-24 md:h-24" />
                    </div>
                ))}
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-4xl w-full">
                
                {/* Characters and Coins Row */}
                <div className="flex items-end justify-center space-x-4 md:space-x-12 mb-8">
                    {/* Character 1 */}
                    <img 
                        src="https://robohash.org/roblox-warrior?set=set1&size=200x200" 
                        alt="Character 1" 
                        className="w-24 h-24 md:w-40 md:h-40 drop-shadow-2xl transform -rotate-6 animate-bounce"
                        style={{ animationDuration: '2s' }}
                    />
                    
                    {/* Big Pile of Robux */}
                    <div className="flex flex-col items-center mb-4">
                         <div className="flex -space-x-4">
                            <RobuxIcon className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 drop-shadow-lg animate-pulse" />
                            <RobuxIcon className="w-20 h-20 md:w-32 md:h-32 text-yellow-400 drop-shadow-xl z-10" />
                            <RobuxIcon className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 drop-shadow-lg animate-pulse" />
                         </div>
                    </div>

                    {/* Character 2 */}
                    <img 
                        src="https://robohash.org/roblox-builder?set=set1&size=200x200" 
                        alt="Character 2" 
                        className="w-24 h-24 md:w-40 md:h-40 drop-shadow-2xl transform rotate-6 animate-bounce"
                        style={{ animationDuration: '2.2s' }}
                    />
                </div>

                {/* Message Box */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-4 border-yellow-500 p-8 rounded-3xl shadow-2xl text-center transform scale-100 flex flex-col items-center">
                    <h2 className="text-3xl md:text-5xl text-white font-bold leading-tight mb-4" style={{ textShadow: '2px 2px 0 #000' }}>
                        Win <span className="text-yellow-400">1000 Robux</span>!
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-300 font-bold mb-6">
                        Answer correctly to collect them all.
                    </p>
                    
                    <button 
                        onClick={handleStartGame}
                        className="bg-green-500 hover:bg-green-600 text-white text-2xl md:text-3xl font-black py-4 px-12 rounded-xl shadow-lg animate-pulse transform hover:scale-105 transition-all"
                        style={{ border: '4px solid black', boxShadow: '0 8px 0 #004400' }}
                    >
                        START GAME
                    </button>
                </div>
            </div>
        </div>
    );
  }

  if (!currentQuestion) {
    return <div className="text-white text-4xl">Loading...</div>;
  }

  const getButtonClass = (option: number) => {
    if (!isAnswered) {
      return 'bg-blue-600 hover:bg-blue-700';
    }
    if (option === currentQuestion?.answer) {
      return 'bg-green-500 animate-pulse';
    }
    if (option === feedback.incorrectSelection) {
      return 'bg-red-500';
    }
    return 'bg-blue-600 opacity-50';
  };
  
  const isTypedAnswerCorrect = isAnswered && parseInt(typedAnswer, 10) === currentQuestion?.answer;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto p-4 relative">
      
      {/* STREAK COUNTER - INLINE POSITION */}
      {/* Using a set height container prevents jumping when streak appears/disappears */}
      <div className={`h-16 flex items-center justify-center transition-all duration-500 ${correctStreak > 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div className="flex items-center space-x-2 bg-black bg-opacity-60 p-2 px-4 rounded-full border-2 border-orange-500 shadow-lg">
            <FireIcon className="w-6 h-6 md:w-8 md:h-8 animate-pulse text-orange-500" />
            <span className="text-orange-400 font-bold text-lg md:text-2xl" style={{ textShadow: '1px 1px 0 #000' }}>Streak: {correctStreak}</span>
          </div>
      </div>

      <div className="text-black text-6xl md:text-8xl font-bold mb-8 md:mb-12 mt-2" style={{ textShadow: '3px 3px 4px rgba(255,255,255,0.7)' }}>
        {currentQuestion.num1} x {currentQuestion.num2}
      </div>

      {robuxScore < 900 ? (
          <div className="grid grid-cols-2 gap-4 md:gap-8 w-full">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={isAnswered}
                className={`text-white text-4xl md:text-6xl font-bold py-10 md:py-16 rounded-2xl shadow-xl transition-all duration-300 ${getButtonClass(option)} disabled:cursor-not-allowed`}
                style={{ 
                  border: '6px solid black',
                  boxShadow: '10px 10px 0px #000000'
                }}
              >
                {option}
              </button>
            ))}
          </div>
      ) : (
        <form onSubmit={handleTypedAnswerSubmit} className="flex flex-col items-center gap-6 w-full">
            <input
                type="number"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={isAnswered}
                className={`text-black text-4xl md:text-6xl text-center font-bold p-4 rounded-2xl w-full max-w-xs transition-colors duration-300 ${
                    isAnswered ? (isTypedAnswerCorrect ? 'bg-green-200' : 'bg-red-200') : 'bg-white'
                }`}
                style={{ 
                    border: `6px solid ${isAnswered ? (isTypedAnswerCorrect ? '#22c55e' : '#ef4444') : 'black'}`,
                    boxShadow: 'inset 5px 5px 10px #00000040'
                }}
                autoFocus
            />
            <button
                type="submit"
                disabled={isAnswered || !typedAnswer.trim()}
                className="text-white text-3xl md:text-4xl font-bold py-4 px-10 rounded-2xl shadow-xl bg-green-600 hover:bg-green-700 transition-all duration-300 disabled:cursor-not-allowed disabled:bg-gray-500"
                style={{ 
                    border: '6px solid black',
                    boxShadow: '10px 10px 0px #000000'
                }}
            >
                Submit
            </button>

            {isAnswered && !isTypedAnswerCorrect && (
                <div className="mt-4 text-3xl font-bold text-center" style={{ textShadow: '2px 2px 4px #000' }}>
                    Correct answer: <span className="text-green-400 animate-pulse">{currentQuestion?.answer}</span>
                </div>
            )}
        </form>
      )}
    </div>
  );
};


// ============================================================================
// APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('selecting_difficulty');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Easy);
  const [robuxScore, setRobuxScore] = useState<number>(0);
  const [language, setLanguage] = useState<Language>(Language.English);
  
  // Preload voices on app mount to ensure they are ready when the game starts
  useEffect(() => {
      getVoices();
  }, []);

  const handleSelectDifficulty = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameState('playing');
  };
  
  const handleReset = () => {
    setRobuxScore(0);
    setGameState('selecting_difficulty');
  };

  const renderGameState = () => {
    switch (gameState) {
      case 'selecting_difficulty':
        return <DifficultySelector 
                  onSelectDifficulty={handleSelectDifficulty} 
                  selectedLanguage={language}
                  onSelectLanguage={setLanguage}
                />;
      case 'playing':
        return <GameScreen 
                  difficulty={difficulty} 
                  language={language}
                  robuxScore={robuxScore} 
                  setRobuxScore={setRobuxScore}
                  setGameState={setGameState}
                />;
      case 'won':
        return <VictoryScreen onPlayAgain={handleReset} />;
      default:
        return null;
    }
  };

  return (
    <main 
      className="bg-cover bg-center h-screen w-screen text-white flex flex-col items-center justify-center p-4 overflow-hidden" 
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1614728263952-84ea256ec346?q=80&w=1920&h=1080&auto=format&fit=crop')" }}
    >
      {gameState !== 'won' && (
        <div className="absolute top-4 right-4 flex items-center space-x-4 z-50">
          <div className="flex items-center space-x-2 bg-black bg-opacity-60 p-2 px-4 rounded-full text-xl md:text-2xl" style={{ border: '2px solid white' }}>
            <RobuxIcon className="w-8 h-8"/>
            <span>{robuxScore}</span>
          </div>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 p-3 rounded-full transition-transform transform hover:scale-110" style={{ border: '2px solid white' }}>
            <ResetIcon className="w-6 h-6"/>
          </button>
        </div>
      )}
      
      <div className="w-full h-full flex items-center justify-center">
        {renderGameState()}
      </div>
      
    </main>
  );
};


// ============================================================================
// RENDER
// ============================================================================
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);