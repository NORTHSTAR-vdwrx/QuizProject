<script>
  import { onMount, tick } from 'svelte';
  import SiteHeader from '../../components/SiteHeader.svelte';
  import { apiRequest, asList, displayError, unwrap } from '../../lib/api.js';

  let sessions = [];
  let selectedSessionId = '';
  let session = null;
  let questions = [];
  let answers = {};
  let currentIndex = 0;
  let attemptId = '';
  let quizTitle = 'Assessment';
  let loadError = '';
  let saveError = '';
  let isLoading = true;
  let submitting = false;
  let confirmingSubmit = false;
  let savedState = 'All progress saved';
  let panelElement;
  const pendingSaves = new Map();
  const saveQueues = new Map();

  $: currentQuestion = questions[currentIndex] || null;
  $: currentAnswer = currentQuestion ? answerFor(currentQuestion) : emptyAnswer();
  $: answeredCount = questions.filter((question) => isAnswered(question, answers[idOf(question)])).length;
  $: progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  onMount(load);

  function idOf(value) {
    return value?.id ?? value?.question_id;
  }

  function isAnswered(question, value) {
    if (!value) return false;
    if (questionType(question) === 'matching') {
      const mapping = value.answer_data?.value;
      return Boolean(mapping && Object.values(mapping).some((choice) => String(choice).trim()));
    }
    if (questionType(question) === 'hotspot') {
      return Number.isFinite(Number(value.answer_data?.x))
        && Number.isFinite(Number(value.answer_data?.y))
        && Object.keys(value.answer_data || {}).length > 0;
    }
    return hasAnswer(value);
  }

  function hasAnswer(value) {
    if (value === undefined || value === null) return false;
    if (typeof value !== 'object') return String(value).trim() !== '';
    return Boolean(
      value.selected_option_ids?.length
      || (typeof value.text_answer === 'string' && value.text_answer.trim())
      || (value.answer_data && Object.keys(value.answer_data).length)
    );
  }

  function emptyAnswer() {
    return { selected_option_ids: [], text_answer: null, answer_data: {} };
  }

  function answerFor(question) {
    const saved = answers[String(idOf(question))];
    if (!saved || typeof saved !== 'object') return emptyAnswer();
    return {
      selected_option_ids: Array.isArray(saved.selected_option_ids) ? saved.selected_option_ids.map(String) : [],
      text_answer: saved.text_answer ?? null,
      answer_data: saved.answer_data && typeof saved.answer_data === 'object' ? saved.answer_data : {}
    };
  }

  function questionType(question) {
    return String(question?.question_type || question?.type || '').toLowerCase();
  }

  function isChoiceQuestion(question) {
    return ['single_choice', 'multiple_choice', 'true_false'].includes(questionType(question));
  }

  function isMultipleChoice(question) {
    return questionType(question) === 'multiple_choice';
  }

  function answerText(question) {
    const answer = answerFor(question);
    if (questionType(question) === 'numeric') return answer.answer_data.value ?? answer.text_answer ?? '';
    if (questionType(question) === 'code') return answer.answer_data.code ?? answer.text_answer ?? '';
    return answer.text_answer ?? '';
  }

  function interactionOf(question) {
    const config = question?.interaction_config;
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  }

  function matchingPrompts(question) {
    const prompts = interactionOf(question).prompts;
    return Array.isArray(prompts) ? prompts.map(String) : [];
  }

  function matchingChoices(question) {
    const choices = interactionOf(question).choices;
    return Array.isArray(choices) ? choices.map(String) : [];
  }

  function matchingAnswer(question, prompt) {
    const mapping = answerFor(question).answer_data?.value;
    return mapping && typeof mapping === 'object' ? String(mapping[prompt] ?? '') : '';
  }

  function fillBlankParts(question) {
    const text = String(titleOf(question));
    const match = /_{2,}/.exec(text);
    if (!match) return { before: text, after: '', hasPlaceholder: false, extraPlaceholders: false };
    return {
      before: text.slice(0, match.index),
      after: text.slice(match.index + match[0].length),
      hasPlaceholder: true,
      extraPlaceholders: /_{2,}/.test(text.slice(match.index + match[0].length))
    };
  }

  function imageSource(question) {
    if (question?.image_url) return String(question.image_url);
    const media = Array.isArray(question?.media) ? question.media : [];
    const item = media.find((entry) => ['image', 'diagram'].includes(String(entry?.media_type || '').toLowerCase()) && entry.url);
    return item?.url ? String(item.url) : '';
  }

  function hotspotPoint(question) {
    const data = answerFor(question).answer_data;
    if (!Number.isFinite(Number(data?.x)) || !Number.isFinite(Number(data?.y))) return null;
    return { x: Number(data.x), y: Number(data.y) };
  }

  function optionsOf(question) {
    const raw = question.options || question.choices || question.answers || [];
    if (Array.isArray(raw)) {
      return raw.map((option, index) => {
        if (typeof option === 'string') return { value: option, label: option };
        const value = option.id ?? option.value ?? option.text ?? option.label ?? String(index);
        return { value: String(value), label: option.option_text ?? option.text ?? option.label ?? option.value ?? String(value) };
      });
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({
        value: key,
        label: typeof value === 'string' ? value : value?.text || value?.label || key
      }));
    }
    return [];
  }

  function isTextAnswer(question) {
    return !isChoiceQuestion(question);
  }

  function titleOf(question) {
    return question?.question_text || question?.text || question?.prompt || question?.question || question?.title || 'Question';
  }

  async function load() {
    const params = new URLSearchParams(window.location.search);
    selectedSessionId = params.get('session_id') || '';
    const requestedAttempt = params.get('attempt_id');

    try {
      if (requestedAttempt) {
        const attempt = unwrap(await apiRequest(`/attempts/${encodeURIComponent(requestedAttempt)}`), 'attempt');
        attemptId = String(attempt.id ?? attempt.attempt_id ?? requestedAttempt);
        selectedSessionId = String(attempt.exam_session_id ?? attempt.session_id ?? selectedSessionId);
        session = selectedSessionId
          ? unwrap(await apiRequest(`/sessions/${encodeURIComponent(selectedSessionId)}`), 'session')
          : null;
        if (attempt.answers && typeof attempt.answers === 'object') {
          answers = normalizeAnswers(attempt.answers);
        }
      } else {
        sessions = asList(await apiRequest('/sessions'));
      }

      if (selectedSessionId) await loadSession(selectedSessionId);
    } catch (error) {
      loadError = displayError(error, 'Could not load this assessment.');
    } finally {
      isLoading = false;
    }
  }

  function normalizeAnswers(raw) {
    if (Array.isArray(raw)) {
      return Object.fromEntries(raw.map((answer) => [
        String(answer.question_id ?? answer.questionId ?? answer.id),
        {
          selected_option_ids: answer.selected_option_ids || [],
          text_answer: answer.text_answer ?? answer.answer ?? answer.value ?? answer.text ?? null,
          answer_data: answer.answer_data || {}
        }
      ]));
    }
    return Object.fromEntries(Object.entries(raw || {}).map(([questionId, answer]) => [
      questionId,
      typeof answer === 'object' && answer !== null
        ? {
            selected_option_ids: answer.selected_option_ids || [],
            text_answer: answer.text_answer ?? null,
            answer_data: answer.answer_data || {}
          }
        : { ...emptyAnswer(), text_answer: String(answer ?? '') }
    ]));
  }

  async function loadSession(sessionId) {
    session = unwrap(await apiRequest(`/sessions/${encodeURIComponent(sessionId)}`), 'session');
    const quiz = session.quiz || {};
    const quizId = session.quiz_id ?? quiz.id;
    quizTitle = session.quiz_title || session.title || quiz.title || session.name || 'Assessment';
    if (!quizId) {
      throw new Error('This exam session is not linked to a quiz.');
    }

    if (!attemptId) {
      const attemptResult = await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/attempt`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const attempt = unwrap(attemptResult, 'attempt');
      attemptId = String(attempt.id ?? attempt.attempt_id ?? attempt.attempt?.id ?? '');
      if (!attemptId) {
        throw new Error('The server did not return an attempt identifier.');
      }
      const persistedAnswers = attempt.answers ?? attempt.attempt?.answers;
      if (persistedAnswers) answers = normalizeAnswers(persistedAnswers);
      if (attempt.submitted_at || attempt.status === 'submitted') {
        window.location.assign(`/results/?attempt_id=${encodeURIComponent(attemptId)}`);
      }
    }

    const attempt = unwrap(await apiRequest(`/attempts/${encodeURIComponent(attemptId)}`), 'attempt');
    quizTitle = attempt.quiz_title || quizTitle;
    questions = asList(attempt.questions);
    answers = normalizeAnswers(attempt.answers || []);
    currentIndex = 0;
    if (attempt.status === 'submitted') {
      window.location.assign(`/results/?attempt_id=${encodeURIComponent(attemptId)}`);
      return;
    }
    if (!questions.length) {
      throw new Error('This quiz does not have any questions yet.');
    }
  }

  async function animateQuestion() {
    await tick();
    const gsap = window.gsap;
    if (!gsap || !panelElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(panelElement, { autoAlpha: 0.7, y: 5 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.18,
      ease: 'power1.out',
      clearProps: 'transform,opacity,visibility'
    });
  }

  async function selectSession(event) {
    event.preventDefault();
    if (!selectedSessionId) return;
    isLoading = true;
    loadError = '';
    try {
      await loadSession(selectedSessionId);
      const url = new URL(window.location.href);
      url.searchParams.set('session_id', selectedSessionId);
      window.history.replaceState({}, '', url);
    } catch (error) {
      loadError = displayError(error, 'Could not open this assessment.');
    } finally {
      isLoading = false;
    }
  }

  function updateAnswer(value) {
    if (!currentQuestion) return;
    const questionId = String(idOf(currentQuestion));
    const type = questionType(currentQuestion);
    let answer;
    if (isChoiceQuestion(currentQuestion)) {
      answer = { ...emptyAnswer(), selected_option_ids: value.map(String) };
    } else if (type === 'numeric') {
      answer = { ...emptyAnswer(), answer_data: value.trim() ? { value: value.trim() } : {} };
    } else if (type === 'code') {
      answer = { ...emptyAnswer(), answer_data: value.trim() ? { code: value } : {} };
    } else {
      answer = { ...emptyAnswer(), text_answer: value === '' ? null : value };
    }
    answers = { ...answers, [questionId]: answer };
    queueAnswerSave(currentQuestion);
  }

  function updateMatching(prompt, choice) {
    const prompts = matchingPrompts(currentQuestion);
    if (!prompts.length) return;
    const previous = answerFor(currentQuestion).answer_data?.value || {};
    const mapping = Object.fromEntries(prompts.map((item) => [item, String(previous[item] ?? '')]));
    mapping[prompt] = choice;
    const questionId = String(idOf(currentQuestion));
    answers = {
      ...answers,
      [questionId]: { ...emptyAnswer(), answer_data: { value: mapping } }
    };
    queueAnswerSave(currentQuestion);
  }

  function setHotspotPoint(x, y) {
    if (!currentQuestion) return;
    const questionId = String(idOf(currentQuestion));
    answers = {
      ...answers,
      [questionId]: {
        ...emptyAnswer(),
        answer_data: {
          x: Math.min(1, Math.max(0, x)),
          y: Math.min(1, Math.max(0, y))
        }
      }
    };
    queueAnswerSave(currentQuestion);
  }

  function queueAnswerSave(question) {
    const questionId = String(idOf(question));
    savedState = 'Saving…';
    saveError = '';
    if (pendingSaves.has(questionId)) clearTimeout(pendingSaves.get(questionId));
    pendingSaves.set(questionId, setTimeout(() => saveAnswer(question), 450));
  }

  function placeHotspot(event) {
    const image = event.currentTarget.querySelector('img');
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    const bounds = image.getBoundingClientRect();
    setHotspotPoint(
      (event.clientX - bounds.left) / bounds.width,
      (event.clientY - bounds.top) / bounds.height
    );
  }

  function moveHotspotWithKeyboard(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    const point = hotspotPoint(currentQuestion) || { x: 0.5, y: 0.5 };
    const step = event.shiftKey ? 0.05 : 0.01;
    if (event.key === 'Enter' || event.key === ' ') {
      setHotspotPoint(point.x, point.y);
    } else if (event.key === 'ArrowLeft') {
      setHotspotPoint(point.x - step, point.y);
    } else if (event.key === 'ArrowRight') {
      setHotspotPoint(point.x + step, point.y);
    } else if (event.key === 'ArrowUp') {
      setHotspotPoint(point.x, point.y - step);
    } else {
      setHotspotPoint(point.x, point.y + step);
    }
  }

  function clearHotspot() {
    const questionId = String(idOf(currentQuestion));
    answers = {
      ...answers,
      [questionId]: emptyAnswer()
    };
    queueAnswerSave(currentQuestion);
  }

  function toggleOption(optionId) {
    const selected = answerFor(currentQuestion).selected_option_ids;
    if (isMultipleChoice(currentQuestion)) {
      updateAnswer(
        selected.includes(String(optionId))
          ? selected.filter((id) => id !== String(optionId))
          : [...selected, String(optionId)]
      );
    } else {
      updateAnswer([String(optionId)]);
    }
  }

  async function saveAnswer(question) {
    if (!question || !attemptId) return;
    const questionId = String(idOf(question));
    if (pendingSaves.has(questionId)) {
      clearTimeout(pendingSaves.get(questionId));
      pendingSaves.delete(questionId);
    }
    const previousSave = saveQueues.get(questionId) || Promise.resolve();
    const save = previousSave.catch(() => {}).then(() => apiRequest(
      `/attempts/${encodeURIComponent(attemptId)}/answers/${encodeURIComponent(questionId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(answerFor(question))
      }
    ));
    saveQueues.set(questionId, save);
    try {
      await save;
      savedState = 'All progress saved';
      return true;
    } catch (error) {
      saveError = displayError(error, 'Could not save your answer.');
      savedState = 'Not saved';
      return false;
    } finally {
      if (saveQueues.get(questionId) === save) saveQueues.delete(questionId);
    }
  }

  async function goTo(index) {
    if (index < 0 || index >= questions.length) return;
    if (currentQuestion && Object.prototype.hasOwnProperty.call(answers, String(idOf(currentQuestion)))) {
      await saveAnswer(currentQuestion);
    }
    currentIndex = index;
    await animateQuestion();
  }

  async function finishAttempt() {
    if (!attemptId || submitting) return;
    submitting = true;
    loadError = '';
    try {
      for (const question of questions) {
        const questionId = String(idOf(question));
        if (Object.prototype.hasOwnProperty.call(answers, questionId)) {
          const saved = await saveAnswer(question);
          if (!saved) throw new Error('An answer could not be saved. Check the message above and try submitting again.');
        }
      }
      let logFailure = '';
      try {
        await apiRequest(`/attempts/${encodeURIComponent(attemptId)}/log`, {
          method: 'PATCH',
          body: JSON.stringify({ log_text: `Submitted with ${answeredCount} of ${questions.length} questions answered.` })
        });
      } catch (error) {
        logFailure = displayError(error, 'The activity log could not be saved.');
      }
      await apiRequest(`/attempts/${encodeURIComponent(attemptId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const logNotice = logFailure ? `&log_error=${encodeURIComponent(logFailure)}` : '';
      window.location.assign(`/results/?attempt_id=${encodeURIComponent(attemptId)}${logNotice}`);
    } catch (error) {
      loadError = displayError(error, 'Could not submit your assessment. Your saved answers are still available.');
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Eval. | {quizTitle}</title>
  <meta name="description" content="Complete your assessment and track your progress." />
</svelte:head>

<SiteHeader />

<main class="quiz-shell">
  {#if isLoading}
    <div class="quiz-message page-copy" role="status">Loading your assessment…</div>
  {:else if loadError && !questions.length}
    <section class="quiz-message quiz-error" role="alert">
      <p>{loadError}</p>
      <a class="quiz-text-link" href="/home/">Back to your space</a>
    </section>
  {:else if !selectedSessionId}
    <section class="quiz-picker">
      <p class="eyebrow">ASSESSMENTS</p>
      <h1 class="page-title">Choose a session.</h1>
      <p class="page-copy">Your progress is saved as you work. You can move between questions at any time.</p>
      {#if sessions.length}
        <form class="session-picker-form" onsubmit={selectSession}>
          <label for="session-picker">Available assessment</label>
          <select id="session-picker" bind:value={selectedSessionId} required>
            <option value="" disabled>Select a scheduled exam</option>
            {#each sessions as item}
              <option value={String(item.id ?? item.session_id)}>
              {item.quiz_title || item.title || item.name || `Scheduled exam ${item.id ?? item.session_id}`}
              </option>
            {/each}
          </select>
          <button class="quiz-primary" type="submit">Start assessment <span aria-hidden="true">→</span></button>
        </form>
      {:else}
        <div class="quiz-empty">
          <h2>No sessions are available.</h2>
          <p>When an exam is scheduled for you, it will appear here.</p>
          <a class="quiz-text-link" href="/home/">Return to your dashboard</a>
        </div>
      {/if}
    </section>
  {:else if questions.length}
    <div class="quiz-topline">
      <a class="quiz-back" href="/home/">← Your space</a>
      <p class="quiz-save-state" aria-live="polite">
        <span class:save-failed={savedState === 'Not saved'}></span>{savedState}
      </p>
    </div>
    <header class="quiz-heading">
      <div>
        <p class="eyebrow">ASSESSMENT IN PROGRESS</p>
        <h1>{quizTitle}</h1>
      </div>
      <div class="quiz-progress-copy">
        <strong>{progress}%</strong>
        <span>{answeredCount} of {questions.length} answered</span>
      </div>
    </header>
    <div class="quiz-progress-track" role="progressbar" aria-label="Assessment completion" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
      <span style={`width: ${progress}%`}></span>
    </div>

    {#if loadError}<p class="quiz-inline-error" role="alert">{loadError}</p>{/if}
    {#if saveError}<p class="quiz-inline-error" role="alert">{saveError}</p>{/if}

    <div class="quiz-layout">
      <aside class="question-rail" aria-label="Question navigation">
        <div class="rail-heading">
          <span>QUESTIONS</span>
          <span>{answeredCount}/{questions.length}</span>
        </div>
        <div class="question-rail-list">
          {#each questions as question, index (idOf(question))}
            {@const questionAnswered = isAnswered(question, answers[String(idOf(question))])}
            <button
              type="button"
              class="question-jump"
              class:is-current={index === currentIndex}
              class:is-answered={questionAnswered}
              aria-current={index === currentIndex ? 'step' : undefined}
              aria-label={`Question ${index + 1}, ${questionAnswered ? 'answered' : 'not answered'}`}
              onclick={() => goTo(index)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{questionAnswered ? 'Answered' : 'Not answered'}</span>
            </button>
          {/each}
        </div>
        <div class="rail-legend">
          <span><i class="legend-dot done"></i>Answered</span>
          <span><i class="legend-dot"></i>Not answered</span>
        </div>
      </aside>

      <section class="question-panel" bind:this={panelElement} aria-labelledby="question-title">
        <div class="question-meta">
          <span>QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>
          <span>{questionType(currentQuestion).replaceAll('_', ' ').toUpperCase()}</span>
        </div>
        {#if questionType(currentQuestion) === 'fill_blank'}
          {@const parts = fillBlankParts(currentQuestion)}
          <div class="fillblank-question-text" id="question-title">
            <span>{parts.before}</span>
            <input
              class="fillblank-inline-input"
              type="text"
              value={answerText(currentQuestion)}
              aria-label="Answer for blank 1"
              autocomplete="off"
              oninput={(event) => updateAnswer(event.currentTarget.value)}
            />
            <span>{parts.after}</span>
          </div>
          <p class="interaction-hint">
            {parts.extraPlaceholders
              ? 'Only the first blank is interactive; additional blank markers are not graded separately.'
              : 'One answer is graded for this question.'}
          </p>
        {:else}
          <h2 id="question-title">{titleOf(currentQuestion)}</h2>
        {/if}

        {#if questionType(currentQuestion) === 'matching'}
          {#if matchingPrompts(currentQuestion).length && matchingChoices(currentQuestion).length}
            <div class="matching-instructions">Choose one match for each prompt. You can change a selection at any time.</div>
            <div class="matching-list">
              {#each matchingPrompts(currentQuestion) as prompt, index (index)}
                <label class="matching-row">
                  <span class="matching-prompt"><span>{String(index + 1).padStart(2, '0')}</span>{prompt}</span>
                  <span class="matching-arrow" aria-hidden="true">→</span>
                  <select
                    class="matching-select"
                    aria-label={`Match for ${prompt}`}
                    value={matchingAnswer(currentQuestion, prompt)}
                    onchange={(event) => updateMatching(prompt, event.currentTarget.value)}
                  >
                    <option value="">Choose a match…</option>
                    {#each matchingChoices(currentQuestion) as choice, choiceIndex (choiceIndex)}
                      <option value={choice}>{choice}</option>
                    {/each}
                  </select>
                </label>
              {/each}
            </div>
          {:else}
            <p class="interaction-error" role="alert">This matching question is missing its prompts or choices. Please contact your teacher.</p>
          {/if}
        {:else if questionType(currentQuestion) === 'hotspot'}
          {@const source = imageSource(currentQuestion)}
          {@const point = hotspotPoint(currentQuestion)}
          {#if source}
            <p class="interaction-hint">Select a point on the image. Coordinates are relative to the image; use arrow keys to fine-tune the marker.</p>
            <div
              class="hotspot-image"
              class:hotspot-has-point={Boolean(point)}
              role="button"
              tabindex="0"
              aria-label="Image hotspot. Click to place a point or use the arrow keys to move it. Hold Shift to move by a larger step."
              aria-pressed={Boolean(point)}
              onclick={placeHotspot}
              onkeydown={moveHotspotWithKeyboard}
            >
              <img src={source} alt="" draggable="false" />
              {#if point}
                <span
                  class="hotspot-marker"
                  style={`left: ${point.x * 100}%; top: ${point.y * 100}%`}
                  aria-hidden="true"
                ></span>
              {/if}
            </div>
            <div class="hotspot-controls">
              <span>{point ? `Selected at ${(point.x * 100).toFixed(1)}%, ${(point.y * 100).toFixed(1)}%` : 'No point selected'}</span>
              {#if point}<button type="button" class="quiz-text-button" onclick={clearHotspot}>Clear point</button>{/if}
            </div>
          {:else}
            <p class="interaction-error" role="alert">This hotspot question has no image. Please contact your teacher.</p>
          {/if}
        {:else if questionType(currentQuestion) !== 'fill_blank' && isTextAnswer(currentQuestion)}
          <label class="blank-answer-label" for="blank-answer">Your answer</label>
          {#if questionType(currentQuestion) === 'long_answer' || questionType(currentQuestion) === 'code'}
            <textarea
              id="blank-answer"
              class="blank-answer"
              rows="6"
              value={answerText(currentQuestion)}
              placeholder={questionType(currentQuestion) === 'code' ? 'Write your code response…' : 'Write your response…'}
              oninput={(event) => updateAnswer(event.currentTarget.value)}
            ></textarea>
          {:else}
            <input
              id="blank-answer"
              class="blank-answer"
              type={questionType(currentQuestion) === 'numeric' ? 'number' : 'text'}
              step={questionType(currentQuestion) === 'numeric' ? 'any' : undefined}
              value={answerText(currentQuestion)}
              placeholder={['matching', 'ordering', 'hotspot', 'drag_drop'].includes(questionType(currentQuestion)) ? 'Enter your response (JSON supported)…' : 'Type your answer here'}
              autocomplete="off"
              oninput={(event) => updateAnswer(event.currentTarget.value)}
            />
          {/if}
        {:else}
          <fieldset class="mcq-options">
            <legend>{isMultipleChoice(currentQuestion) ? 'Choose all that apply' : 'Choose one answer'}</legend>
            {#each optionsOf(currentQuestion) as option, index (String(option.value))}
              <label class="mcq-option" class:is-selected={currentAnswer.selected_option_ids.includes(String(option.value))}>
                <input
                  type={isMultipleChoice(currentQuestion) ? 'checkbox' : 'radio'}
                  name={`question-${idOf(currentQuestion)}`}
                  value={String(option.value)}
                  checked={currentAnswer.selected_option_ids.includes(String(option.value))}
                  onchange={() => toggleOption(option.value)}
                />
                <span class="option-marker">{String.fromCharCode(65 + index)}</span>
                <span class="option-copy">{option.label}</span>
                <span class="option-check" aria-hidden="true">✓</span>
              </label>
            {/each}
          </fieldset>
        {/if}

        <div class="question-controls">
          <button type="button" class="quiz-secondary" onclick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
            ← Previous
          </button>
          <span class="question-position">{currentIndex + 1} / {questions.length}</span>
          {#if currentIndex < questions.length - 1}
            <button type="button" class="quiz-primary" onclick={() => goTo(currentIndex + 1)}>
              Next question <span aria-hidden="true">→</span>
            </button>
          {:else if confirmingSubmit}
            <div class="submit-confirmation">
              <span>{questions.length - answeredCount} unanswered</span>
              <button type="button" class="quiz-primary" onclick={finishAttempt} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Confirm submit'}
              </button>
              <button type="button" class="quiz-text-button" onclick={() => (confirmingSubmit = false)}>Keep working</button>
            </div>
          {:else}
            <button type="button" class="quiz-primary" onclick={() => (confirmingSubmit = true)}>
              Review & submit <span aria-hidden="true">→</span>
            </button>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</main>
