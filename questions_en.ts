export interface Question {
    id: string;
    text: string;
    scale: {
        min: number;
        max: number;
        minLabel: string;
        maxLabel: string;
    };
}

export const questions: Question[] = [
    // Block 1
    { id: 'A1', text: 'How much of the time do you feel you are making progress towards accomplishing your goals?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'E1', text: 'How often do you become absorbed in what you are doing?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'P1', text: 'In general, how often do you feel joyful?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'N1', text: 'In general, how often do you feel anxious?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'A2', text: 'How often do you achieve the important goals you have set for yourself?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },

    // Block 2
    { id: 'H1', text: 'In general, how would you say your health is?', scale: { min: 0, max: 10, minLabel: 'Terrible', maxLabel: 'Excellent' } },

    // Block 3
    { id: 'M1', text: 'In general, to what extent do you lead a purposeful and meaningful life?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'R1', text: 'To what extent do you receive help and support from others when you need it?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'M2', text: 'In general, to what extent do you feel that what you do in your life is valuable and worthwhile?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'E2', text: 'In general, to what extent do you feel excited and interested in things?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'Lon', text: 'How lonely do you feel in your daily life?', scale: { min: 0, max: 10, minLabel: 'Not at all lonely', maxLabel: 'Very lonely' } },

    // Block 4
    { id: 'H2', text: 'How satisfied are you with your current physical health?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },

    // Block 5
    { id: 'P2', text: 'In general, how often do you feel positive?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'N2', text: 'In general, how often do you feel angry?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'A3', text: 'How often are you able to handle your responsibilities?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'N3', text: 'In general, how often do you feel sad?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },
    { id: 'E3', text: 'How often do you lose track of time while doing something you enjoy?', scale: { min: 0, max: 10, minLabel: 'Never', maxLabel: 'Always' } },

    // Block 6
    { id: 'H3', text: 'Compared to others of your same age and sex, how is your health?', scale: { min: 0, max: 10, minLabel: 'Much worse', maxLabel: 'Much better' } },

    // Block 7
    { id: 'R2', text: 'To what extent do you feel loved?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'M3', text: 'To what extent do you generally feel you have a sense of direction in your life?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'R3', text: 'How satisfied are you with your personal relationships?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
    { id: 'P3', text: 'In general, to what extent do you feel contented?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },

    // Block 8
    { id: 'hap', text: 'Taking all things together, how happy would you say you are?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' } },
];
