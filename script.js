document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.step');
    const nextButtons = document.querySelectorAll('.next-button'); // Selects all including round ones
    const prevButtons = document.querySelectorAll('.prev-button');
    const submitButton = document.querySelector('.submit-button');
    const startButton = document.querySelector('.start-button');
    const progressIndicators = document.querySelectorAll('.progress-indicator div');
    const questionnaireContainer = document.querySelector('.questionnaire-container'); // For slider update

    const userAnswers = {};
    let currentStep = 0; // Start at introduction screen
    let isTransitioning = false; // Flag to prevent rapid clicks during transition

    // --- Debounce Function ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Tracking Function --- (Placeholder)
    function trackEvent(eventName, eventProperties = {}) {
        console.log(`Tracking Event: ${eventName}`, eventProperties);
        // Later: Integrate with Plausible or other analytics
    }
    const debouncedTrackEvent = debounce(trackEvent, 400); // Debounce tracking for inputs

    // --- Update Progress Indicator (Separate function for clarity) ---
    function updateProgressIndicator(stepIndex) {
        // Question steps are 2-6 (HTML indices), corresponding to questions 1-5
        // Clear all indicators first
        progressIndicators.forEach(indicator => {
            indicator.classList.remove('active');
        });
        
        // For question steps (2-6), calculate which indicators should be active
        if (stepIndex >= 2 && stepIndex <= 6) {
            // Calculate which question we're on (0-indexed)
            const questionNumber = stepIndex - 2;
            
            // Set active class for all indicators up to and including current question
            for (let i = 0; i <= questionNumber && i < progressIndicators.length; i++) {
                progressIndicators[i].classList.add('active');
            }
            
            console.log(`Step ${stepIndex}, Question ${questionNumber+1}, Active indicators: ${questionNumber+1}`);
        }
    }

    // --- Function to Show Specific Step ---
    function showStep(stepIndex) {
        if (isTransitioning) return; // Prevent switching during transition
        isTransitioning = true;

        const currentStepElement = steps[currentStep];
        const nextStepElement = steps[stepIndex];

        // Fade out current step
        if (currentStepElement) {
            currentStepElement.style.opacity = '0';
        }

        // Wait for fade out, then switch display and fade in
        setTimeout(() => {
            steps.forEach((step, index) => {
                // Use display: flex; for active step, none for others
                step.style.display = index === stepIndex ? 'flex' : 'none';
            });

            // Trigger fade in for the new step
            if (nextStepElement) {
                 // Force reflow/repaint before changing opacity for transition to work
                void nextStepElement.offsetWidth;
                nextStepElement.style.opacity = '1';
            }

            // Update Progress Indicator using the new function
            console.log(`[showStep] Calling updateProgressIndicator with stepIndex: ${stepIndex}`);
            updateProgressIndicator(stepIndex);

            // Log view event when showing a question step
            if (stepIndex >= 2 && stepIndex <= 6) {
                const questionId = `vraag${stepIndex - 1}`;
                // Don't track view on initial load of step 0
                if(stepIndex !== 0) {
                    trackEvent('QuestionViewed', { questionId });
                }
            }

            currentStep = stepIndex;
            isTransitioning = false; // Allow switching again

        }, 400); // Match CSS transition duration
    }

    // --- Navigation Logic ---
    startButton.addEventListener('click', () => {
        if (isTransitioning) return;
        trackEvent('QuestionnaireStarted');
        const nextStepIndex = 2; // Go directly to Vraag 1 (step 2)
        trackEvent('MapsdNext', { fromQuestionId: 'intro', toQuestionId: 'vraag1' });
        showStep(nextStepIndex);
    });

    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isTransitioning) return;
            const currentQuestionStep = currentStep - 1;
            const questionId = `vraag${currentQuestionStep}`;

            // --- Validation --- 
            const currentStepElement = steps[currentStep];
            let isValid = true;

            // Single choice validation
            const singleChoiceContainer = currentStepElement.querySelector('.options-container.single-choice');
            if (singleChoiceContainer && !singleChoiceContainer.querySelector('.selected')) {
                 alert('Selecteer alstublieft een optie.');
                 isValid = false;
            }

            // Multiple choice validation
            const multipleChoiceContainer = currentStepElement.querySelector('.options-container.multiple-choice');
            if (multipleChoiceContainer && multipleChoiceContainer.querySelectorAll('.selected').length === 0) {
                 alert('Selecteer alstublieft minimaal één optie.');
                 isValid = false;
            }

            // 'Anders' input validation
             const andersOptionSelected = currentStepElement.querySelector('.option-anders.selected');
             if (andersOptionSelected) {
                 const andersInput = document.getElementById('oppervlakte_anders_input');
                 if (andersInput.value.trim() === '') {
                      alert('Vul alstublieft de oppervlakte in.');
                      isValid = false;
                 } else {
                     // Ensure the latest value is saved and tracked just before navigating
                     const finalAndersValue = `anders: ${andersInput.value.trim()}`;
                     if (userAnswers['vraag3'] !== finalAndersValue) {
                         userAnswers['vraag3'] = finalAndersValue;
                         trackEvent('AnswerChanged', { questionId: 'vraag3', value: finalAndersValue }); // Track final value
                     }
                 }
             }

            if (!isValid) return; // Stop navigation if invalid
            // --- End Validation ---

            const fromQuestionId = currentStep >= 2 ? `vraag${currentStep - 1}` : 'intro';
            const nextStepIndex = currentStep + 1;
            const toQuestionId = nextStepIndex >= 2 && nextStepIndex <= 6 ? `vraag${nextStepIndex - 1}` : 'eindscherm';

            trackEvent('MapsdNext', { fromQuestionId, toQuestionId });
            showStep(nextStepIndex);
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isTransitioning) return;
            const fromQuestionId = `vraag${currentStep - 1}`;
            const prevStepIndex = currentStep - 1;
            // Ensure we don't go back further than the first question (step 2)
            if (prevStepIndex < 2) return;
            const toQuestionId = `vraag${prevStepIndex - 1}`;

            trackEvent('MapsdPrevious', { fromQuestionId, toQuestionId });
            showStep(prevStepIndex);
        });
    });

    submitButton.addEventListener('click', () => {
        if (isTransitioning) return;
        // Save final answer (slider value already updated on input)
        if (!userAnswers['vraag5']) { // Ensure slider value is captured if user didn't move it
            updateSliderAppearance(false); // Update value without tracking again if needed
        }
        trackEvent('QuestionnaireSubmitted', { finalAnswers: userAnswers });
        showStep(steps.length - 1); // Show thank you screen (last step, index 7)
    });

    // --- Answer Handling ---

    // Vraag 1: Doel aankoop (Single Choice - Step 2)
    const vraag1Options = document.querySelectorAll('#step-2 .option');
    vraag1Options.forEach(option => {
        option.addEventListener('click', () => {
            vraag1Options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            const value = option.getAttribute('data-value');
            userAnswers['vraag1'] = value;
            trackEvent('AnswerChanged', { questionId: 'vraag1', value });
        });
    });

    // Vraag 2: Doel unit (Multiple Choice - Step 3)
    const vraag2Options = document.querySelectorAll('#step-3 .option');
    vraag2Options.forEach(option => {
        option.addEventListener('click', () => {
             option.classList.toggle('selected');
            const selectedValues = Array.from(vraag2Options)
                                       .filter(opt => opt.classList.contains('selected'))
                                       .map(opt => opt.getAttribute('data-value'));
            userAnswers['vraag2'] = selectedValues;
            // Track change for multiple choice
            trackEvent('AnswerChanged', { questionId: 'vraag2', value: selectedValues });
        });
    });

    // Vraag 3: Oppervlakte (Single Choice + Anders - Step 4)
     const vraag3Options = document.querySelectorAll('#step-4 .option');
     const andersInput = document.getElementById('oppervlakte_anders_input');
     vraag3Options.forEach(option => {
        option.addEventListener('click', () => {
            const isAndersOption = option.classList.contains('option-anders');
             vraag3Options.forEach(opt => {
                 opt.classList.remove('selected');
                 if (opt.classList.contains('option-anders') && !isAndersOption) {
                      andersInput.disabled = true;
                      andersInput.value = '';
                 }
             });
            option.classList.add('selected');
            const value = option.getAttribute('data-value');

            if (isAndersOption) {
                andersInput.disabled = false;
                andersInput.focus();
                userAnswers['vraag3'] = `anders: ${andersInput.value.trim()}`; // Initial value
            } else {
                andersInput.disabled = true;
                andersInput.value = '';
                userAnswers['vraag3'] = value;
                 trackEvent('AnswerChanged', { questionId: 'vraag3', value }); // Track non-anders selection immediately
            }
        });
    });

    // Debounced tracking for 'anders' input
    andersInput.addEventListener('input', debounce(() => {
        if (!andersInput.disabled) {
             const inputValue = andersInput.value.trim();
            userAnswers['vraag3'] = `anders: ${inputValue}`;
            trackEvent('AnswerChanged', { questionId: 'vraag3', value: userAnswers['vraag3'] });
        }
    }, 500)); // 500ms debounce delay

    // Vraag 4: Financiering Type (Single Choice - Step 5)
    const vraag4Options = document.querySelectorAll('#step-5 .option');
    vraag4Options.forEach(option => {
        option.addEventListener('click', () => {
            vraag4Options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            const value = option.getAttribute('data-value');
            userAnswers['vraag4'] = value;
            trackEvent('AnswerChanged', { questionId: 'vraag4', value });
        });
    });

     // Vraag 5: Eigen Geld (Slider - Step 6)
    const slider = document.getElementById('eigen-geld-slider');
    const sliderValueDisplay = document.getElementById('slider-value-display');
    const sliderLabels = [
        "€0", "€25.000", "€75.000", "€100.000", "€200.000", "€500.000", "€1.000.000"
    ];
     const sliderRangeValues = [
        "0", "0-25k", "25k-75k", "75k-100k", "100k-200k", "200k-500k", "500k-1M"
    ];

    // Function to update slider appearance AND store value/track event
    function updateSliderAppearance(shouldTrack = true) {
        const value = parseInt(slider.value, 10);
        const max = parseInt(slider.max, 10);
        const min = parseInt(slider.min, 10);
        const percentage = ((value - min) / (max - min)) * 100;

        // Update CSS variable for track fill (background gradient)
        slider.style.setProperty('--slider-fill-percent', `${percentage}%`);

        // Update display text
        if (sliderValueDisplay) {
            sliderValueDisplay.textContent = sliderLabels[value] || '€?';
        }

        // Save the range string
        const rangeValue = sliderRangeValues[value];
        userAnswers['vraag5'] = rangeValue;

        // Track change (conditionally)
        if (shouldTrack) {
            // Use debounced tracking for slider input
            debouncedTrackEvent('AnswerChanged', { questionId: 'vraag5', value: rangeValue });
        }
    }

    // Use regular function for direct call
    // slider.addEventListener('input', updateSliderAppearance);
    // Use arrow function to pass shouldTrack=true to the event listener
    slider.addEventListener('input', () => updateSliderAppearance(true));

    // --- Initialisation ---
    // Show step 0 without animation initially
    steps.forEach((step, index) => {
         step.style.display = index === 0 ? 'flex' : 'none';
         step.style.opacity = index === 0 ? '1' : '0';
    });
    currentStep = 0;
    updateSliderAppearance(false); // Set initial slider appearance and value without tracking

}); 