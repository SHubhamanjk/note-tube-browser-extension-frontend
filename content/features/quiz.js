(function() {
  const ns = window.Medha || (window.Medha = {});
  ns.features = ns.features || {};
  const { state } = ns;
  const { escapeHtml, showNotification } = ns;
  const { getVideoPlayer } = ns.youtube;

  async function generateQuiz() {
    if (!state.currentTutorialId) return;
    const fromInput = document.getElementById('quiz-from-time');
    const toInput = document.getElementById('quiz-to-time');
    const fromTime = fromInput.value || '0:00';
    let toTime = toInput.value;
    if (!toTime) { 
        const player = getVideoPlayer(); 
        const duration = player ? player.duration : 0; 
        toTime = duration > 0 ? ns.youtube.formatTime(Math.floor(duration)) : 'End'; 
        toInput.value = toTime; 
    }
    const btn = document.getElementById('medha-generate-quiz'); btn.disabled = true; btn.innerHTML = '<span class="medha-spinner"></span> Generating...';
    try {
      const response = await chrome.runtime.sendMessage({ action: 'generateQuiz', data: { tutorialId: state.currentTutorialId, fromTimestamp: fromTime, toTimestamp: toTime } });
      showNotification && showNotification(' Quiz generated successfully!', 'success');
      showQuizAttempt(response.id, response);
    } catch (error) { 
      showNotification && showNotification('❌ Quiz generation failed: ' + error.message, 'error'); 
    }
    finally { 
      await loadQuizzes(); 
    }
  }

  async function loadQuizzes(maxRetries = 0, attempt = 0) {
    if (!state.currentTutorialId) return;
    const container = document.getElementById('medha-quiz-list'); if (!container) return;
    if (attempt === 0) {
      container.innerHTML = '<div class="medha-skeleton-loader"><div class="medha-skeleton-card"></div><div class="medha-skeleton-card"></div></div>';
    }
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTutorialQuizzes', data: { tutorialId: state.currentTutorialId } });
      const quizzes = response.data || [];
      
      const genBtn = document.getElementById('medha-generate-quiz');
      if (genBtn) {
        let msgEl = document.getElementById('quiz-limit-msg');
        if (!msgEl) {
          msgEl = document.createElement('div');
          msgEl.id = 'quiz-limit-msg';
          genBtn.parentNode.insertBefore(msgEl, genBtn.nextSibling);
        }
        
        if (quizzes.length >= 2) {
          genBtn.disabled = true;
          genBtn.innerHTML = 'Quiz Limit Reached (2/2)';
          genBtn.style.opacity = '0.7';
          genBtn.style.cursor = 'not-allowed';
          
          msgEl.style.cssText = "background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 10px 12px; margin-top: 12px; display: flex; align-items: flex-start; gap: 8px;";
          msgEl.innerHTML = `
            <span style="font-size: 16px; line-height: 1;">⚠️</span>
            <p style="margin: 0; color: #fca5a5; font-size: 12px; line-height: 1.4;">
              <strong>Quiz Limit Reached</strong><br>
              Quiz generation requires significant AI compute, so we currently limit it to 2 per tutorial. We are working on increasing this limit!
            </p>
          `;
          msgEl.style.display = 'flex';
        } else if (quizzes.length === 1) {
          genBtn.disabled = false;
          genBtn.innerHTML = 'Generate Quiz (1 Left)';
          genBtn.style.opacity = '1';
          genBtn.style.cursor = 'pointer';
          
          msgEl.style.cssText = "background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px; padding: 10px 12px; margin-top: 12px; display: flex; align-items: flex-start; gap: 8px;";
          msgEl.innerHTML = `
            <span style="font-size: 16px; line-height: 1;">💡</span>
            <p style="margin: 0; color: #fcd34d; font-size: 12px; line-height: 1.4;">
              <strong>1 of 2 Quizzes Generated</strong><br>
              Due to high AI compute costs, there is a limit of 2 quizzes per tutorial. You have 1 generation remaining.
            </p>
          `;
          msgEl.style.display = 'flex';
        } else {
          genBtn.disabled = false;
          genBtn.innerHTML = 'Generate Quiz';
          genBtn.style.opacity = '1';
          genBtn.style.cursor = 'pointer';
          msgEl.style.display = 'none';
        }
      }
      
      if (quizzes.length === 0) {
        if (attempt < maxRetries) {
          setTimeout(() => loadQuizzes(maxRetries, attempt + 1), 2000);
          return;
        }
        container.innerHTML = '<div class="medha-empty-state"><div class="medha-empty-icon">📝</div><div class="medha-empty-text">No quizzes yet. Generate your first quiz!</div></div>';
      } else {
        container.innerHTML = quizzes.map(quiz => {
          const totalQuestions = quiz.questions ? quiz.questions.length : 0;
          const isEvaluated = quiz.status === 'completed';
          const evaluation = quiz.evaluation || {};
          const score = evaluation.total_score || 0;
          const maxScore = evaluation.max_score || (totalQuestions * 2);
          const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
          const quizId = quiz.id;
          const date = new Date(quiz.created_at).toLocaleDateString();

          return `
          <div class="medha-quiz-card">
            <div class="medha-quiz-card-header">
              <span class="medha-quiz-time-range">Generated on ${date}</span>
              <span class="medha-quiz-questions">${totalQuestions} questions</span>
            </div>
            ${isEvaluated ? `
              <div class="medha-quiz-score"><span class="score-percentage">${Math.round(percentage)}%</span><span class="score-text">${score}/${maxScore} points</span></div>
            ` : ''}
            <div class="medha-quiz-actions">
              ${isEvaluated ? `
                <button class="medha-btn-secondary medha-btn-sm quiz-retry-btn" data-quiz-id="${quizId}"><span class="icon">🔄</span> Retry</button>
                <button class="medha-btn-secondary medha-btn-sm quiz-results-btn" data-quiz-id="${quizId}"><span class="icon">📊</span> View Results</button>
              ` : `
                <button class="medha-btn-primary medha-btn-sm quiz-attempt-btn" data-quiz-id="${quizId}"><span class="icon">▶️</span> Attempt Quiz</button>
              `}
            </div>
          </div>
          `}).join('');
        container.querySelectorAll('.quiz-attempt-btn, .quiz-retry-btn').forEach(btn => { 
            btn.addEventListener('click', () => {
                const quiz = quizzes.find(q => q.id === btn.dataset.quizId);
                showQuizAttempt(btn.dataset.quizId, quiz); 
            }); 
        });
        container.querySelectorAll('.quiz-results-btn').forEach(btn => { 
            btn.addEventListener('click', () => {
                const quiz = quizzes.find(q => q.id === btn.dataset.quizId);
                showQuizResults(btn.dataset.quizId, quiz); 
            }); 
        });
      }
    } catch (error) {
      container.innerHTML = '<div class="medha-empty-state"><div class="medha-empty-icon">❌</div><div class="medha-empty-text">Failed to load quizzes</div></div>';
    }
  }

  async function showQuizAttempt(quizId, quizData) {
    const player = getVideoPlayer(); const wasPlaying = player && !player.paused; if (wasPlaying) { player.pause(); }
    if (!quizData) {
        showNotification && showNotification('❌ Failed to load quiz.', 'error');
        if (wasPlaying && player) { player.play().catch(() => {}); } return;
    }
    const allQuestions = quizData.questions || [];
    if (allQuestions.length === 0) {
        showNotification && showNotification('❌ This quiz has no questions. It may have failed to generate properly.', 'error');
        if (wasPlaying && player) { player.play().catch(() => {}); } return;
    }
    let currentQuestionIndex = 0; let answers = {};
    const modal = document.createElement('div'); modal.className = 'medha-quiz-modal';
    modal.innerHTML = `
      <style>
        .medha-quiz-modal-footer .medha-btn-secondary {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .medha-quiz-modal-footer .medha-btn-secondary:hover {
            background-color: rgba(255, 255, 255, 0.2) !important;
        }
        .medha-quiz-modal-footer .medha-btn-secondary:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
        }
        #descriptive-answer-reveal {
            color: #e0e0e0 !important;
        }
      </style>
      <div class="medha-quiz-modal-content">
        <div class="medha-quiz-modal-header"><h2>📝 Quiz Attempt</h2><button class="medha-minimize-btn" id="quiz-cancel" style="font-size: 24px; line-height: 1;">&times;</button></div>
        <div class="medha-quiz-modal-body">
          <div class="medha-quiz-progress">
            <div class="medha-quiz-progress-text">Question <span id="quiz-current">1</span> of <span id="quiz-total">${allQuestions.length}</span></div>
            <div class="medha-quiz-progress-bar"><div class="medha-quiz-progress-fill" id="quiz-progress"></div></div>
          </div>
          <div class="medha-quiz-question-container" id="quiz-question-container"></div>
          <div class="medha-quiz-navigation" style="justify-content: center; margin-top: 15px; margin-bottom: 5px;">
            <div class="medha-quiz-dots" id="quiz-dots"></div>
          </div>
        </div>
        <div class="medha-quiz-modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
          <button class="medha-btn-secondary" id="quiz-prev-btn" style="min-width: 115px; white-space: nowrap;">← Previous</button>
          <div style="display: flex; justify-content: center; flex: 1;">
            <button class="medha-btn-primary" id="quiz-submit" style="width: auto; min-width: 120px;">Submit Quiz</button>
          </div>
          <button class="medha-btn-secondary" id="quiz-next-btn" style="min-width: 115px; white-space: nowrap;">Next →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function renderDots() {
      const container = document.getElementById('quiz-dots');
      container.innerHTML = allQuestions.map((q, i) => {
        const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
        const isCurrent = i === currentQuestionIndex;
        return `<span class="medha-quiz-dot ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" data-index="${i}"></span>`;
      }).join('');
      container.querySelectorAll('.medha-quiz-dot').forEach(dot => { dot.addEventListener('click', () => { currentQuestionIndex = parseInt(dot.dataset.index); renderQuestion(currentQuestionIndex); }); });
    }

    function renderQuestion(index) {
      const question = allQuestions[index]; const container = document.getElementById('quiz-question-container');

      if (question.type === 'mcq') {
        const hasAnswered = answers[question.id] !== undefined;
        container.innerHTML = `
          <div class="medha-quiz-question"><h3>${escapeHtml(question.question)}</h3><div class="medha-quiz-options">${question.options.map((opt, i) => {
            const isSelected = answers[question.id] === i;
            const isCorrect = opt === question.answer;
            let style = '';
            if (hasAnswered) {
                if (isCorrect) style = 'background: rgba(46, 204, 113, 0.1); border-color: #2ecc71; color: #2ecc71;';
                else if (isSelected) style = 'background: rgba(231, 76, 60, 0.1); border-color: #e74c3c; color: #e74c3c;';
                else style = 'opacity: 0.6;';
            }
            return `
            <label class="medha-quiz-option ${isSelected ? 'selected' : ''}" style="${style}">
              <input type="radio" name="question-${question.id}" value="${i}" ${isSelected ? 'checked' : ''} ${hasAnswered ? 'disabled' : ''}>
              <span>${escapeHtml(opt)}</span>
            </label>`;
          }).join('')}</div></div>`;
        
        if (!hasAnswered) {
            container.querySelectorAll('input[type="radio"]').forEach(radio => { radio.addEventListener('change', (e) => { answers[question.id] = parseInt(e.target.value); renderQuestion(index); renderDots(); }); });
        }
      } else {
        container.innerHTML = `<div class="medha-quiz-question"><h3>${escapeHtml(question.question)}</h3>
            <textarea class="medha-quiz-textarea" id="descriptive-answer" placeholder="Type your answer here..." rows="8">${answers[question.id] || ''}</textarea>
            <div style="margin-top: 15px; text-align: right;">
                <button class="medha-btn-secondary medha-btn-sm" id="inline-show-ans-btn" style="border-color: #2ecc71; color: #2ecc71;">Show Answer</button>
            </div>
            <div id="descriptive-answer-reveal" style="display: none; margin-top: 15px; padding: 12px; background: rgba(46, 204, 113, 0.1); border-left: 4px solid #2ecc71; border-radius: 4px; font-size: 14px; line-height: 1.5;">
                <strong style="color: #2ecc71; margin-bottom: 6px; display: block;">Correct Answer:</strong>
                ${escapeHtml(question.answer)}
            </div>
        </div>`;
        const textarea = document.getElementById('descriptive-answer'); textarea.addEventListener('input', (e) => { answers[question.id] = e.target.value; renderDots(); });
        const inlineBtn = document.getElementById('inline-show-ans-btn');
        if (inlineBtn) {
            inlineBtn.onclick = function() {
                const reveal = document.getElementById('descriptive-answer-reveal');
                if (reveal) { reveal.style.display = 'block'; this.style.display = 'none'; }
            };
        }
      }
      document.getElementById('quiz-current').textContent = index + 1;
      document.getElementById('quiz-progress').style.width = `${((index + 1) / allQuestions.length) * 100}%`;
      document.getElementById('quiz-prev-btn').disabled = index === 0;
      document.getElementById('quiz-next-btn').disabled = index === allQuestions.length - 1;
      renderDots();
    }

    document.getElementById('quiz-prev-btn').addEventListener('click', () => { if (currentQuestionIndex > 0) { currentQuestionIndex--; renderQuestion(currentQuestionIndex); } });
    document.getElementById('quiz-next-btn').addEventListener('click', () => { if (currentQuestionIndex < allQuestions.length - 1) { currentQuestionIndex++; renderQuestion(currentQuestionIndex); } });
    document.getElementById('quiz-cancel').addEventListener('click', () => { 
        if (confirm("Your answers will not be evaluated or saved. Are you sure you want to cancel?")) {
            modal.remove(); 
            if (wasPlaying && player) { player.play().catch(() => {}); } 
        }
    });
    document.getElementById('quiz-submit').addEventListener('click', async () => {
      const unanswered = allQuestions.filter(q => answers[q.id] === undefined || answers[q.id] === '');
      if (unanswered.length > 0) { if (!confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`)) return; }
      const answersArray = Object.entries(answers).map(([questionIdStr, answerVal]) => {
          const qId = parseInt(questionIdStr);
          const question = allQuestions.find(q => q.id === qId);
          let finalAnswer = answerVal.toString();
          if (question && question.type === 'mcq' && typeof answerVal === 'number') {
              finalAnswer = question.options[answerVal];
          }
          return { question_id: qId, answer: finalAnswer };
      });
      const submitBtn = document.getElementById('quiz-submit'); submitBtn.disabled = true; submitBtn.textContent = 'Submitting...';
      try {
        const result = await chrome.runtime.sendMessage({ action: 'evaluateQuiz', data: { quizId, answers: answersArray } });
        modal.remove(); showNotification && showNotification(' Quiz submitted successfully!', 'success'); await loadQuizzes(); 
        const mockQuizData = {
            questions: allQuestions,
            user_answers: answersArray,
            evaluation: result
        };
        showQuizResultsModal(mockQuizData);
        if (wasPlaying && player) { player.play().catch(() => {}); }
      } catch (error) {
        showNotification && showNotification('❌ Failed to submit quiz: ' + error.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Submit Quiz';
      }
    });
    renderQuestion(currentQuestionIndex);
  }

  async function showQuizResults(quizId, quizData) {
    if (!quizData || !quizData.evaluation) { showNotification && showNotification('⚠️ No evaluation report found', 'warning'); return; }
    showQuizResultsModal(quizData);
  }

  function showQuizResultsModal(quizData) {
    const player = getVideoPlayer(); const wasPlaying = player && !player.paused; if (wasPlaying) { player.pause(); }
    const evaluation = quizData.evaluation;
    const modal = document.createElement('div'); modal.className = 'medha-quiz-modal';
    const totalQuestions = (evaluation.feedback || []).length; 
    const maxScore = evaluation.max_score || 0;
    const score = evaluation.total_score || 0;
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    modal.innerHTML = `
      <div class="medha-quiz-modal-content">
        <div class="medha-quiz-modal-header"><h2>📊 Quiz Results</h2><button class="medha-minimize-btn" id="results-minimize" style="font-size: 24px; line-height: 1;">&times;</button></div>
        <div class="medha-quiz-modal-body">
          <div class="medha-quiz-results-summary">
            <div class="medha-score-circle"><div class="medha-score-number">${Math.round(percentage)}%</div><div class="medha-score-label">Score</div></div>
            <div class="medha-score-details">
              <p><strong>Total Score:</strong> ${score} / ${maxScore} points</p>
              <p><strong>Total Questions:</strong> ${totalQuestions}</p>
            </div>
          </div>
          <div class="medha-divider"></div>
          <div class="medha-quiz-results-details">
            <h3>📝 Overall Feedback</h3>
            <p class="medha-overall-feedback">${escapeHtml(evaluation.overall_analysis || 'Great job!')}</p>
            <div id="medha-detailed-feedback-container"></div>
          </div>
        </div>
        <div class="medha-quiz-modal-footer"><button class="medha-btn-primary" id="results-close">Close</button></div>
      </div>`;
    document.body.appendChild(modal);
    
    // Render detailed feedback manually after appending
    const feedbackContainer = document.getElementById('medha-detailed-feedback-container');
    if (quizData.questions && quizData.questions.length > 0) {
        const mcqQuestions = quizData.questions.filter(q => q.type === 'mcq');
        const descQuestions = quizData.questions.filter(q => q.type === 'descriptive');
        
        const renderQuestionsList = (questionsList, startIndex) => {
            return questionsList.map((question, i) => {
                const idx = startIndex + i;
                const feedbackItem = (evaluation.feedback || []).find(f => f.question_id === question.id);
                const userAnswerObj = (quizData.user_answers || []).find(a => a.question_id === question.id);
                const userAnswer = userAnswerObj ? userAnswerObj.answer : 'Not answered';
                const isCorrect = feedbackItem ? feedbackItem.is_correct : false;
                const score = feedbackItem ? feedbackItem.score : 0;
                const feedbackStr = feedbackItem ? feedbackItem.feedback : 'No evaluation found.';
                
                let answerHtml = '';
                if (question.type === 'mcq') {
                    answerHtml = `<div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">`;
                    question.options.forEach(opt => {
                        let isSelected = opt === userAnswer;
                        let isRightAnswer = opt === question.answer;
                        let style = 'padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: #e0e0e0; font-size: 14px; display: flex; justify-content: space-between; align-items: center;';
                        let iconHtml = '';
                        if (isRightAnswer) {
                            style += ' border-color: #2ecc71; background: rgba(46, 204, 113, 0.1);';
                            iconHtml = `<span style="color: #2ecc71; font-weight: bold; font-size: 12px;">${isSelected ? '✓ Correct Answer' : '← Correct Answer'}</span>`;
                        } else if (isSelected) {
                            style += ' border-color: #e74c3c; background: rgba(231, 76, 60, 0.1);';
                            iconHtml = `<span style="color: #e74c3c; font-weight: bold; font-size: 12px;">✗ Your Answer</span>`;
                        }
                        answerHtml += `<div style="${style}"><span>${escapeHtml(opt)}</span>${iconHtml}</div>`;
                    });
                    answerHtml += `</div>`;
                    if (userAnswer === 'Not answered') {
                        answerHtml += `<div style="color: #e74c3c; margin-top: 10px; font-weight: bold; font-size: 13px;">⚠️ You did not answer this question.</div>`;
                    }
                } else {
                    answerHtml = `
                      <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                        <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                            <strong style="color: #a0a0a0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your Answer</strong><br/>
                            <div style="color: ${userAnswer === 'Not answered' ? '#e74c3c' : '#ffffff'}; margin-top: 4px; font-size: 14px; white-space: pre-wrap;">${escapeHtml(userAnswer)}</div>
                        </div>
                        <div style="padding: 12px; background: rgba(46, 204, 113, 0.05); border-radius: 6px; border: 1px solid rgba(46, 204, 113, 0.2);">
                            <strong style="color: #2ecc71; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Correct Answer</strong><br/>
                            <div style="color: #e0e0e0; margin-top: 4px; font-size: 14px; white-space: pre-wrap;">${escapeHtml(question.answer)}</div>
                        </div>
                      </div>
                    `;
                }
                
                const feedbackSection = (feedbackItem && feedbackItem.feedback) ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); color: #c0c0c0; font-size: 14px; line-height: 1.6;">
                        <strong style="color: #ffffff;">Explanation:</strong> ${escapeHtml(feedbackItem.feedback)}
                    </div>` : '';

                return `<div class="medha-feedback-item ${isCorrect ? 'correct' : 'incorrect'}" style="margin-bottom: 16px; padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-left: 4px solid ${isCorrect ? '#2ecc71' : '#e74c3c'};">
                    <div style="margin-bottom: 16px;">
                        <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #fff; margin-right: 8px;">Q${idx + 1}</span>
                        <span style="color: #a0a0a0; font-size: 12px; font-weight: bold;">${score} points</span>
                        <div style="color: #ffffff; font-size: 16px; font-weight: 500; margin-top: 10px; line-height: 1.5;">${escapeHtml(question.question)}</div>
                    </div>
                    ${answerHtml}
                    ${feedbackSection}
                </div>`;
            }).join('');
        };

        let html = '';
        if (mcqQuestions.length > 0) {
            html += `<div style="margin-top: 30px;"><h4 style="color: #6366f1; margin-bottom: 15px; font-size: 16px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 20px;">🎯</span> Multiple Choice Questions</h4>`;
            html += renderQuestionsList(mcqQuestions, 0);
            html += `</div>`;
        }
        if (descQuestions.length > 0) {
            html += `<div style="margin-top: 30px;"><h4 style="color: #6366f1; margin-bottom: 15px; font-size: 16px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 20px;">✍️</span> Descriptive Questions</h4>`;
            html += renderQuestionsList(descQuestions, mcqQuestions.length);
            html += `</div>`;
        }
        feedbackContainer.innerHTML = html;
    }

    document.getElementById('results-close').addEventListener('click', () => { 
        modal.remove(); 
        if (wasPlaying && player) { player.play().catch(() => {}); }
    });
    document.getElementById('results-minimize').addEventListener('click', () => { 
        modal.remove(); 
        window.Medha.ui && window.Medha.ui.toggleMinimize && window.Medha.ui.toggleMinimize(); 
        if (wasPlaying && player) { player.play().catch(() => {}); }
    });
  }

  ns.features.generateQuiz = generateQuiz;
  ns.features.loadQuizzes = loadQuizzes;
  ns.features.showQuizAttempt = showQuizAttempt;
  ns.features.showQuizResults = showQuizResults;
  ns.features.showQuizResultsModal = showQuizResultsModal;
})();


