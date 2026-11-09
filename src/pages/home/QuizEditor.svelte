<script>
  import { onMount } from 'svelte';
  import { apiRequest, asList, displayError, unwrap } from '../../lib/api.js';

  export let quiz;
  export let onBack = () => {};
  export let onQuizUpdated = () => {};

  const questionTypes = [
    ['single_choice', 'Multiple choice'],
    ['multiple_choice', 'Multiple select'],
    ['true_false', 'True / false'],
    ['short_answer', 'Short answer'],
    ['numeric', 'Numeric'],
    ['fill_blank', 'Fill in the blank'],
    ['matching', 'Matching'],
    ['ordering', 'Ordering / ranking'],
    ['hotspot', 'Hotspot'],
    ['drag_drop', 'Drag and drop'],
    ['code', 'Code response'],
    ['long_answer', 'Long answer / essay']
  ];
  const bloomsLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  let activeTab = 'questions';
  let questions = [];
  let selectedQuestionId = '';
  let questionsLoading = true;
  let questionsError = '';
  let questionNotice = '';
  let questionSaving = false;
  let questionDeleting = false;
  let importExportBusy = false;
  let questionSearch = '';
  let questionTypeFilter = 'all';
  let draft = emptyDraft();
  let isEditing = false;
  let answerConfigText = '{}';
  let interactionConfigText = '{}';
  let matchingPromptsText = '';
  let matchingChoicesText = '';
  let matchingCorrectAnswers = {};
  let hotspotTargetX = '0.5';
  let hotspotTargetY = '0.5';
  let hotspotTolerance = '0.05';
  let fillCaseSensitive = false;
  let fillTrimWhitespace = true;
  let fillIgnoreSpaces = false;
  let parameterConfigText = '{}';
  let mediaText = '[]';
  let partialCreditText = '{}';
  let tagText = '';
  let quizSettings = {};
  let settingsSaving = false;
  let settingsError = '';
  let settingsMessage = '';
  let sections = [];
  let sectionsLoading = false;
  let sectionsSaving = false;
  let sectionsError = '';
  let sectionMessage = '';
  let banks = [];
  let banksLoading = false;
  let banksError = '';
  let bankSearch = '';
  let bankTag = '';
  let selectedBankId = '';
  let bankItems = [];
  let bankItemsLoading = false;
  let bankItemsError = '';
  let bankName = '';
  let creatingBank = false;
  let poolCount = 5;
  let poolDifficulty = '';
  let pullingPool = false;
  let selectedRubricQuestion = '';
  let rubricCriteria = [];
  let rubricLoading = false;
  let rubricSaving = false;
  let rubricError = '';
  let rubricMessage = '';
  let versionsForQuestion = '';
  let questionVersions = [];
  let versionsError = '';

  $: filteredQuestions = questions.filter((question) => {
    const matchesText = String(question.question_text || '').toLowerCase().includes(questionSearch.trim().toLowerCase());
    const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;
    return matchesText && matchesType;
  });
  $: selectedQuestion = questions.find((question) => String(question.id) === selectedQuestionId);
  $: matchingPrompts = matchingPromptsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  $: matchingChoices = matchingChoicesText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  $: rubricTotalPoints = rubricCriteria.reduce((total, criterion) => total + (Number(criterion.max_points) || 0), 0);
  onMount(() => {
    quizSettings = {
      title: quiz.title || '',
      duration_minutes: quiz.duration_minutes || 30,
      instructions: quiz.instructions || '',
      shuffle_questions: Boolean(quiz.shuffle_questions),
      shuffle_options: Boolean(quiz.shuffle_options),
      questions_to_serve: quiz.questions_to_serve || '',
      allow_multiple_attempts: Boolean(quiz.allow_multiple_attempts),
      scoring_policy: quiz.scoring_policy || 'latest'
    };
    loadQuestions();
    loadSections();
    loadBanks();
  });

  function emptyDraft() {
    return {
      question_text: '',
      question_type: 'single_choice',
      points: 1,
      image_url: '',
      options: [
        { option_text: '', is_correct: true, feedback: '', media: [], media_text: '[]' },
        { option_text: '', is_correct: false, feedback: '', media: [], media_text: '[]' }
      ],
      accepted_answers_text: '',
      feedback: '',
      worked_solution: '',
      difficulty: '',
      standard_code: '',
      blooms_level: '',
      folder_path: ''
    };
  }

  async function loadQuestions() {
    questionsLoading = true;
    questionsError = '';
    try {
      questions = asList(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/questions`));
      if (selectedQuestionId && !questions.some((item) => String(item.id) === selectedQuestionId)) {
        selectedQuestionId = '';
      }
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not load this quiz’s questions.');
    } finally {
      questionsLoading = false;
    }
  }

  function addQuestion() {
    selectedQuestionId = '';
    isEditing = false;
    draft = emptyDraft();
    answerConfigText = '{}';
    interactionConfigText = '{}';
    matchingPromptsText = '';
    matchingChoicesText = '';
    matchingCorrectAnswers = {};
    hotspotTargetX = '0.5';
    hotspotTargetY = '0.5';
    hotspotTolerance = '0.05';
    fillCaseSensitive = false;
    fillTrimWhitespace = true;
    fillIgnoreSpaces = false;
    clearQuestionNotice();
  }

  function clearQuestionNotice() {
    questionsError = '';
    questionNotice = '';
  }

  function editQuestion(question) {
    clearQuestionNotice();
    selectedQuestionId = String(question.id);
    isEditing = true;
    draft = {
      question_text: question.question_text || '',
      question_type: question.question_type,
      points: question.points || 1,
      image_url: question.image_url || '',
      options: (question.options || []).map((option) => ({
        option_text: option.option_text || '',
        is_correct: Boolean(option.is_correct),
        feedback: option.feedback || '',
        media: option.media || [],
        media_text: JSON.stringify(option.media || [], null, 2)
      })),
      accepted_answers_text: (question.accepted_answers || []).join('\n'),
      feedback: question.feedback || '',
      worked_solution: question.worked_solution || '',
      difficulty: question.difficulty || '',
      standard_code: question.standard_code || '',
      blooms_level: question.blooms_level || '',
      folder_path: question.folder_path || ''
    };
    answerConfigText = JSON.stringify(question.answer_config || {}, null, 2);
    interactionConfigText = JSON.stringify(question.interaction_config || {}, null, 2);
    matchingPromptsText = (question.interaction_config?.prompts || []).join('\n');
    matchingChoicesText = (question.interaction_config?.choices || []).join('\n');
    matchingCorrectAnswers = question.answer_config?.correct_answer || {};
    hotspotTargetX = String(question.answer_config?.correct_answer?.x ?? 0.5);
    hotspotTargetY = String(question.answer_config?.correct_answer?.y ?? 0.5);
    hotspotTolerance = String(question.answer_config?.tolerance ?? 0.05);
    fillCaseSensitive = Boolean(question.answer_config?.case_sensitive);
    fillTrimWhitespace = question.answer_config?.trim_whitespace !== false;
    fillIgnoreSpaces = Boolean(question.answer_config?.ignore_spaces);
    parameterConfigText = JSON.stringify(question.parameter_config || {}, null, 2);
    mediaText = JSON.stringify(question.media || [], null, 2);
    partialCreditText = JSON.stringify(question.partial_credit || {}, null, 2);
    tagText = (question.tags || []).join(', ');
  }

  function setQuestionType(type) {
    draft.question_type = type;
    if (type === 'true_false') {
      draft.options = [
        { option_text: 'True', is_correct: true, feedback: '', media: [], media_text: '[]' },
        { option_text: 'False', is_correct: false, feedback: '', media: [], media_text: '[]' }
      ];
    } else if (['single_choice', 'multiple_choice'].includes(type) && draft.options.length < 2) {
      draft.options = [
        { option_text: '', is_correct: true, feedback: '', media: [], media_text: '[]' },
        { option_text: '', is_correct: false, feedback: '', media: [], media_text: '[]' }
      ];
    }
  }

  function addOption() {
    draft.options = [...draft.options, { option_text: '', is_correct: false, feedback: '', media: [], media_text: '[]' }];
  }

  function removeOption(index) {
    if (draft.options.length <= 2) return;
    draft.options = draft.options.filter((_, optionIndex) => optionIndex !== index);
    if (!draft.options.some((option) => option.is_correct)) {
      draft.options[0].is_correct = true;
    }
  }

  function setOptionCorrect(index, correct) {
    draft.options = draft.options.map((option, optionIndex) => ({
      ...option,
      is_correct: correct
        ? (draft.question_type === 'multiple_choice' ? (optionIndex === index ? !option.is_correct : option.is_correct) : optionIndex === index)
        : optionIndex === index ? false : option.is_correct
    }));
    if (!draft.options.some((option) => option.is_correct) && draft.options.length) {
      draft.options[0].is_correct = true;
    }
  }

  function parseJsonField(text, label, expectedType) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`${label} must be valid JSON.`);
    }
    if (expectedType === 'object' && (!value || Array.isArray(value) || typeof value !== 'object')) {
      throw new Error(`${label} must be a JSON object.`);
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      throw new Error(`${label} must be a JSON array.`);
    }
    return value;
  }

  function questionPayload(position = questions.length) {
    const type = draft.question_type;
    const choiceQuestion = ['single_choice', 'multiple_choice', 'true_false'].includes(type);
    const textQuestion = ['fill_blank', 'short_answer'].includes(type);
    const usesDedicatedConfig = ['fill_blank', 'matching', 'hotspot'].includes(type);
    let answerConfig = usesDedicatedConfig ? {} : parseJsonField(answerConfigText, 'Answer configuration', 'object');
    let interactionConfig = usesDedicatedConfig ? {} : parseJsonField(interactionConfigText, 'Interaction configuration', 'object');
    if (type === 'fill_blank') {
      if ((draft.question_text.match(/_{2,}/g) || []).length > 1) {
        throw new Error('Fill-in-the-blank supports one graded blank per question. Keep only one underscore placeholder.');
      }
      answerConfig = {
        case_sensitive: fillCaseSensitive,
        trim_whitespace: fillTrimWhitespace,
        ignore_spaces: fillIgnoreSpaces
      };
    } else if (type === 'matching') {
      if (!matchingPrompts.length || !matchingChoices.length) {
        throw new Error('Matching questions need at least one prompt and one choice.');
      }
      if (new Set(matchingPrompts).size !== matchingPrompts.length || new Set(matchingChoices).size !== matchingChoices.length) {
        throw new Error('Matching prompts and choices must be unique.');
      }
      const correctAnswer = Object.fromEntries(matchingPrompts.map((prompt) => [
        prompt,
        String(matchingCorrectAnswers[prompt] || '').trim()
      ]));
      if (Object.values(correctAnswer).some((choice) => !choice || !matchingChoices.includes(choice))) {
        throw new Error('Choose a correct match from the available choices for every prompt.');
      }
      interactionConfig = { prompts: matchingPrompts, choices: matchingChoices };
      answerConfig = { correct_answer: correctAnswer };
    } else if (type === 'hotspot') {
      const x = Number(hotspotTargetX);
      const y = Number(hotspotTargetY);
      const tolerance = Number(hotspotTolerance);
      if (!draft.image_url.trim()) throw new Error('Add an image URL for the hotspot question.');
      if (![x, y].every((coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1)) {
        throw new Error('Hotspot target coordinates must be between 0 and 1.');
      }
      if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new Error('Hotspot tolerance must be a non-negative number.');
      }
      answerConfig = { correct_answer: { x, y }, tolerance };
      interactionConfig = {};
    }
    const payload = {
      question_text: draft.question_text.trim(),
      question_type: type,
      points: Number(draft.points),
      position,
      image_url: draft.image_url.trim() || null,
      options: choiceQuestion ? draft.options.map((option) => ({
        option_text: option.option_text.trim(),
        is_correct: Boolean(option.is_correct),
        feedback: option.feedback?.trim() || null,
        media: parseJsonField(option.media_text || '[]', 'Option media', 'array')
      })) : [],
      accepted_answers: textQuestion
        ? draft.accepted_answers_text.split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean)
        : [],
      answer_config: answerConfig,
      interaction_config: interactionConfig,
      parameter_config: parseJsonField(parameterConfigText, 'Parameter configuration', 'object'),
      media: parseJsonField(mediaText, 'Question media', 'array'),
      partial_credit: parseJsonField(partialCreditText, 'Partial credit', 'object'),
      tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean),
      feedback: draft.feedback.trim() || null,
      worked_solution: draft.worked_solution.trim() || null,
      difficulty: draft.difficulty === '' ? null : Number(draft.difficulty),
      standard_code: draft.standard_code.trim() || null,
      blooms_level: draft.blooms_level || null,
      folder_path: draft.folder_path.trim() || null
    };

    if (type === 'numeric' && !Object.keys(payload.parameter_config).length) {
      if (answerConfigText.trim() === '{}') {
        throw new Error('Numeric questions need an answer configuration with a correct_value.');
      }

      function matchingCorrectAnswer(prompt) {
        return String(matchingCorrectAnswers[prompt] || '');
      }

      function setMatchingCorrectAnswer(prompt, choice) {
        matchingCorrectAnswers = { ...matchingCorrectAnswers, [prompt]: choice };
      }

      function setHotspotAuthorTarget(event) {
        const image = event.currentTarget.querySelector('img');
        if (!image || !image.naturalWidth || !image.naturalHeight) return;
        const bounds = image.getBoundingClientRect();
        hotspotTargetX = String(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)).toFixed(4));
        hotspotTargetY = String(Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)).toFixed(4));
      }

      function moveHotspotAuthorTarget(event) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.05 : 0.01;
        let x = Number(hotspotTargetX);
        let y = Number(hotspotTargetY);
        if (event.key === 'ArrowLeft') x -= step;
        if (event.key === 'ArrowRight') x += step;
        if (event.key === 'ArrowUp') y -= step;
        if (event.key === 'ArrowDown') y += step;
        hotspotTargetX = String(Math.min(1, Math.max(0, x)).toFixed(4));
        hotspotTargetY = String(Math.min(1, Math.max(0, y)).toFixed(4));
      }
    }
    return payload;
  }

  async function saveQuestion(event) {
    event.preventDefault();
    questionSaving = true;
    clearQuestionNotice();
    const wasEditing = isEditing;
    try {
      const payload = questionPayload(isEditing ? selectedQuestion.position || 0 : questions.length);
      const path = isEditing
        ? `/questions/${encodeURIComponent(selectedQuestionId)}`
        : `/quizzes/${encodeURIComponent(quiz.id)}/questions`;
      const saved = unwrap(await apiRequest(path, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }), 'question');
      questions = isEditing
        ? questions.map((item) => item.id === saved.id ? saved : item)
        : [...questions, saved];
      selectedQuestionId = String(saved.id);
      isEditing = true;
      editQuestion(saved);
      questionNotice = wasEditing ? 'Question saved.' : 'Question added.';
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not save this question.');
    } finally {
      questionSaving = false;
    }
  }

  async function deleteQuestion() {
    if (!selectedQuestionId || !window.confirm('Delete this question? This cannot be undone.')) return;
    questionDeleting = true;
    clearQuestionNotice();
    try {
      await apiRequest(`/questions/${encodeURIComponent(selectedQuestionId)}`, { method: 'DELETE' });
      questions = questions.filter((question) => String(question.id) !== selectedQuestionId);
      selectedQuestionId = '';
      addQuestion();
      questionNotice = 'Question deleted.';
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not delete this question.');
    } finally {
      questionDeleting = false;
    }
  }

  async function moveQuestion(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    const reordered = [...questions];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    questions = reordered.map((question, position) => ({ ...question, position }));
    try {
      for (const question of questions) {
        const payload = { ...question };
        delete payload.id;
        delete payload.quiz_id;
        delete payload.version;
        delete payload.created_at;
        delete payload.updated_at;
        await apiRequest(`/questions/${encodeURIComponent(question.id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }
      questionNotice = 'Question order saved.';
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not save the new question order.');
      await loadQuestions();
    }
  }

  async function importQuestions(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.size > 5_000_000) {
      questionsError = 'Import files must be 5 MB or smaller.';
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    const format = extension === 'csv' ? 'csv' : extension === 'qti' || extension === 'xml' ? 'qti' : 'json';
    importExportBusy = true;
    clearQuestionNotice();
    try {
      const ids = asList(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/questions/import`, {
        method: 'POST',
        body: JSON.stringify({ format, content: await file.text() })
      }));
      await loadQuestions();
      questionNotice = `Imported ${ids.length} question${ids.length === 1 ? '' : 's'}.`;
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not import questions.');
    } finally {
      importExportBusy = false;
    }
  }

  async function exportQuestions(format) {
    importExportBusy = true;
    clearQuestionNotice();
    try {
      const result = await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/questions/export?format=${format}`);
      const content = format === 'json' ? JSON.stringify(result, null, 2) : String(result);
      const mimeType = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/xml';
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename(quiz.title)}-questions.${format === 'qti' ? 'xml' : format}`;
      link.click();
      URL.revokeObjectURL(url);
      questionNotice = `Questions exported as ${format.toUpperCase()}.`;
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not export questions.');
    } finally {
      importExportBusy = false;
    }
  }

  function safeFilename(value) {
    return String(value || 'quiz').trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'quiz';
  }

  async function saveSettings(event) {
    event.preventDefault();
    settingsSaving = true;
    settingsError = '';
    settingsMessage = '';
    try {
      const payload = {
        title: quizSettings.title.trim(),
        duration_minutes: Number(quizSettings.duration_minutes),
        instructions: quizSettings.instructions.trim(),
        shuffle_questions: Boolean(quizSettings.shuffle_questions),
        shuffle_options: Boolean(quizSettings.shuffle_options),
        questions_to_serve: quizSettings.questions_to_serve === '' ? null : Number(quizSettings.questions_to_serve),
        allow_multiple_attempts: Boolean(quizSettings.allow_multiple_attempts),
        scoring_policy: quizSettings.scoring_policy
      };
      const updated = unwrap(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }), 'quiz');
      quiz = updated;
      quizSettings = { ...quizSettings, ...updated };
      onQuizUpdated(updated);
      settingsMessage = 'Quiz settings saved.';
    } catch (requestError) {
      settingsError = displayError(requestError, 'Could not save quiz settings.');
    } finally {
      settingsSaving = false;
    }
  }

  async function loadSections() {
    sectionsLoading = true;
    sectionsError = '';
    try {
      sections = asList(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/sections`));
    } catch (requestError) {
      sectionsError = displayError(requestError, 'Could not load quiz sections.');
    } finally {
      sectionsLoading = false;
    }
  }

  function addSection() {
    sections = [...sections, {
      title: `Section ${sections.length + 1}`,
      position: sections.length,
      instructions: '',
      time_limit_minutes: null,
      shuffle_questions: false,
      question_ids: []
    }];
  }

  function toggleSectionQuestion(sectionIndex, questionId) {
    const updated = sections.map((section, index) => {
      if (index !== sectionIndex) {
        return {
          ...section,
          question_ids: (section.question_ids || []).filter((id) => String(id) !== String(questionId))
        };
      }
      const questionIds = (section.question_ids || []).map(String);
      return {
        ...section,
        question_ids: questionIds.includes(String(questionId))
          ? questionIds.filter((id) => id !== String(questionId))
          : [...questionIds, String(questionId)]
      };
    });
    sections = updated;
  }

  async function saveSections() {
    sectionsSaving = true;
    sectionsError = '';
    sectionMessage = '';
    try {
      const payload = {
        sections: sections.map((section, position) => ({
          title: section.title.trim(),
          position,
          instructions: section.instructions?.trim() || null,
          time_limit_minutes: section.time_limit_minutes ? Number(section.time_limit_minutes) : null,
          shuffle_questions: Boolean(section.shuffle_questions),
          question_ids: (section.question_ids || []).map(String)
        }))
      };
      sections = asList(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/sections`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }));
      sectionMessage = 'Quiz structure saved.';
    } catch (requestError) {
      sectionsError = displayError(requestError, 'Could not save quiz sections.');
    } finally {
      sectionsSaving = false;
    }
  }

  function removeSection(index) {
    sections = sections.filter((_, sectionIndex) => sectionIndex !== index)
      .map((section, position) => ({ ...section, position }));
  }

  async function loadBanks() {
    banksLoading = true;
    banksError = '';
    try {
      banks = asList(await apiRequest('/question-banks'));
      if (!selectedBankId && banks.length) selectedBankId = String(banks[0].id);
      if (selectedBankId) await loadBankItems();
    } catch (requestError) {
      banksError = displayError(requestError, 'Could not load question banks.');
    } finally {
      banksLoading = false;
    }
  }

  async function createBank(event) {
    event.preventDefault();
    creatingBank = true;
    banksError = '';
    try {
      const bank = unwrap(await apiRequest('/question-banks', {
        method: 'POST',
        body: JSON.stringify({ name: bankName.trim() })
      }), 'bank');
      banks = [...banks, bank];
      selectedBankId = String(bank.id);
      bankName = '';
      bankItems = [];
    } catch (requestError) {
      banksError = displayError(requestError, 'Could not create the question bank.');
    } finally {
      creatingBank = false;
    }
  }

  async function selectBank(event) {
    selectedBankId = event.currentTarget.value;
    await loadBankItems();
  }

  async function loadBankItems() {
    if (!selectedBankId) {
      bankItems = [];
      return;
    }
    bankItemsLoading = true;
    bankItemsError = '';
    try {
      const query = new URLSearchParams();
      if (bankSearch.trim().length >= 2) query.set('search', bankSearch.trim());
      if (bankTag.trim()) query.set('tag', bankTag.trim());
      bankItems = asList(await apiRequest(`/question-banks/${encodeURIComponent(selectedBankId)}/questions?${query}`));
    } catch (requestError) {
      bankItemsError = displayError(requestError, 'Could not load bank questions.');
    } finally {
      bankItemsLoading = false;
    }
  }

  async function saveToBank(question) {
    if (!selectedBankId) return;
    try {
      const payload = questionToWrite(question);
      await apiRequest(`/question-banks/${encodeURIComponent(selectedBankId)}/questions`, {
        method: 'POST',
        body: JSON.stringify({ question: payload })
      });
      questionNotice = 'Question added to the selected bank.';
    } catch (requestError) {
      bankItemsError = displayError(requestError, 'Could not add this question to the bank.');
    }
  }

  function questionToWrite(question) {
    const payload = { ...question };
    for (const field of ['id', 'quiz_id', 'version', 'created_at', 'updated_at']) delete payload[field];
    for (const option of payload.options || []) {
      delete option.id;
    }
    return payload;
  }

  async function addFromBank(item) {
    try {
      const payload = { ...item.question, position: questions.length };
      const saved = unwrap(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/questions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }), 'question');
      questions = [...questions, saved];
      questionNotice = 'Question copied into this quiz.';
    } catch (requestError) {
      bankItemsError = displayError(requestError, 'Could not add this question to the quiz.');
    }
  }

  async function pullQuestionPool(event) {
    event.preventDefault();
    if (!selectedBankId) return;
    pullingPool = true;
    bankItemsError = '';
    try {
      const payload = {
        bank_id: selectedBankId,
        count: Number(poolCount),
        tags: bankTag.trim() ? [bankTag.trim()] : [],
        ...(poolDifficulty ? { difficulty: Number(poolDifficulty) } : {})
      };
      const ids = asList(await apiRequest(`/quizzes/${encodeURIComponent(quiz.id)}/question-pools`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }));
      await loadQuestions();
      questionNotice = `Added ${ids.length} random question${ids.length === 1 ? '' : 's'} from the bank.`;
    } catch (requestError) {
      bankItemsError = displayError(requestError, 'Could not pull questions from this bank.');
    } finally {
      pullingPool = false;
    }
  }

  async function loadRubric(question) {
    selectedRubricQuestion = String(question.id);
    rubricLoading = true;
    rubricError = '';
    rubricMessage = '';
    try {
      rubricCriteria = asList(await apiRequest(`/questions/${encodeURIComponent(question.id)}/rubric`));
      if (!rubricCriteria.length) rubricCriteria = [{ title: '', description: '', max_points: 1 }];
    } catch (requestError) {
      rubricError = displayError(requestError, 'Could not load rubric criteria.');
    } finally {
      rubricLoading = false;
    }
  }

  function addRubricCriterion() {
    rubricCriteria = [...rubricCriteria, { title: '', description: '', max_points: 1 }];
  }

  function removeRubricCriterion(index) {
    rubricCriteria = rubricCriteria.filter((_, criterionIndex) => criterionIndex !== index);
  }

  async function saveRubric() {
    if (rubricCriteria.some((criterion) => !criterion.title.trim() || !Number(criterion.max_points) || Number(criterion.max_points) < 0)) {
      rubricError = 'Give each rubric criterion a title and a positive point value.';
      return;
    }
    if (rubricTotalPoints > Number(draft.points)) {
      rubricError = `Rubric criteria total ${rubricTotalPoints} points, above this question’s ${draft.points}-point maximum.`;
      return;
    }
    rubricSaving = true;
    rubricError = '';
    rubricMessage = '';
    try {
      rubricCriteria = asList(await apiRequest(`/questions/${encodeURIComponent(selectedRubricQuestion)}/rubric`, {
        method: 'PUT',
        body: JSON.stringify({
          criteria: rubricCriteria.filter((criterion) => criterion.title.trim()).map((criterion) => ({
            ...criterion,
            title: criterion.title.trim(),
            max_points: Number(criterion.max_points)
          }))
        })
      }));
      rubricMessage = 'Rubric saved.';
    } catch (requestError) {
      rubricError = displayError(requestError, 'Could not save rubric.');
    } finally {
      rubricSaving = false;
    }
  }

  async function loadVersions(questionId) {
    versionsForQuestion = String(questionId);
    versionsError = '';
    try {
      questionVersions = asList(await apiRequest(`/questions/${encodeURIComponent(questionId)}/versions`));
    } catch (requestError) {
      versionsError = displayError(requestError, 'Could not load question history.');
    }
  }

  async function regradeQuestion(question) {
    if (!window.confirm('Regrade all submitted attempts that contain this question using its current answer key?')) return;
    try {
      const result = unwrap(await apiRequest(`/questions/${encodeURIComponent(question.id)}/regrade`, {
        method: 'POST'
      }), 'result');
      questionNotice = `Regraded ${result.attempts_regraded ?? 0} submitted attempt${result.attempts_regraded === 1 ? '' : 's'}.`;
    } catch (requestError) {
      questionsError = displayError(requestError, 'Could not regrade submitted attempts.');
    }
  }
</script>

<section class="quiz-editor">
  <header class="quiz-editor-heading">
    <div>
      <button type="button" class="teacher-back" onclick={onBack}>← Quiz library</button>
      <h2>{quiz.title}</h2>
      <p>{questions.length} questions · {quiz.duration_minutes} minutes</p>
    </div>
    <div class="quiz-editor-tools">
      <label class="quiz-file-import">
        <input type="file" accept=".json,.csv,.qti,.xml" onchange={importQuestions} disabled={importExportBusy} />
        {importExportBusy ? 'Working…' : 'Import'}
      </label>
      <details class="quiz-export-menu">
        <summary>Export</summary>
        <div>
          <button type="button" onclick={() => exportQuestions('json')}>JSON</button>
          <button type="button" onclick={() => exportQuestions('csv')}>CSV</button>
          <button type="button" onclick={() => exportQuestions('qti')}>QTI</button>
        </div>
      </details>
    </div>
  </header>

  <nav class="quiz-editor-tabs" aria-label="Quiz editor sections">
    <button class:active={activeTab === 'questions'} type="button" onclick={() => (activeTab = 'questions')}>Questions <span>{questions.length}</span></button>
    <button class:active={activeTab === 'structure'} type="button" onclick={() => (activeTab = 'structure')}>Sections</button>
    <button class:active={activeTab === 'bank'} type="button" onclick={() => (activeTab = 'bank')}>Question bank</button>
    <button class:active={activeTab === 'settings'} type="button" onclick={() => (activeTab = 'settings')}>Settings</button>
  </nav>

  {#if questionsError}<p class="teacher-notice teacher-error" role="alert">{questionsError}</p>{/if}
  {#if questionNotice}<p class="teacher-notice teacher-success" role="status">{questionNotice}</p>{/if}

  {#if activeTab === 'questions'}
    <div class="question-workspace">
      <aside class="question-sidebar">
        <div class="question-sidebar-actions">
          <button type="button" class="teacher-button" onclick={addQuestion}>Add question <span aria-hidden="true">+</span></button>
        </div>
        <label class="teacher-search-field">
          <span>Find a question</span>
          <input bind:value={questionSearch} type="search" placeholder="Search question text…" />
        </label>
        <label class="teacher-search-field">
          <span>Question type</span>
          <select bind:value={questionTypeFilter}>
            <option value="all">All types</option>
            {#each questionTypes as [value, label]}<option value={value}>{label}</option>{/each}
          </select>
        </label>
        {#if questionsLoading}<p role="status" class="editor-muted">Loading questions…</p>
        {:else if filteredQuestions.length}
          <ol class="question-list">
            {#each filteredQuestions as question, index (question.id)}
              <li>
                <button type="button" class:question-selected={selectedQuestionId === String(question.id)} onclick={() => editQuestion(question)}>
                  <span class="question-list-number">{String(index + 1).padStart(2, '0')}</span>
                  <span class="question-list-copy"><strong>{question.question_text}</strong><small>{question.question_type.replaceAll('_', ' ')} · {question.points} pt</small></span>
                </button>
                <span class="question-order">
                  <button type="button" aria-label="Move question up" disabled={index === 0} onclick={() => moveQuestion(questions.findIndex((item) => item.id === question.id), -1)}>↑</button>
                  <button type="button" aria-label="Move question down" disabled={index === filteredQuestions.length - 1} onclick={() => moveQuestion(questions.findIndex((item) => item.id === question.id), 1)}>↓</button>
                </span>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="editor-muted">{questions.length ? 'No questions match those filters.' : 'No questions yet. Add one or import a question file.'}</p>
        {/if}
      </aside>

      <div class="question-editor-panel">
        <form class="teacher-form question-composer" onsubmit={saveQuestion}>
          <div class="question-composer-heading">
            <div><p class="eyebrow">{isEditing ? 'QUESTION EDITOR' : 'NEW QUESTION'}</p><h3>{isEditing ? 'Edit question' : 'Write a question'}</h3></div>
            {#if isEditing}<span class="question-version">Version {selectedQuestion?.version || 1}</span>{/if}
          </div>
          <label><span>Question prompt</span><textarea bind:value={draft.question_text} rows="4" maxlength="10000" required placeholder="Write the question…"></textarea></label>
          <div class="editor-form-pair">
            <label><span>Response type</span><select value={draft.question_type} onchange={(event) => setQuestionType(event.currentTarget.value)}>{#each questionTypes as [value, label]}<option value={value}>{label}</option>{/each}</select></label>
            <label><span>Points</span><input bind:value={draft.points} type="number" min="1" step="1" required /></label>
          </div>

          {#if ['single_choice', 'multiple_choice', 'true_false'].includes(draft.question_type)}
            <label><span>Question image URL <small>Optional</small></span><input bind:value={draft.image_url} type="url" placeholder="https://…" /></label>
            <fieldset class="option-editor">
              <legend>{draft.question_type === 'multiple_choice' ? 'Answer options · select every correct answer' : 'Answer options · mark the correct answer'}</legend>
              {#each draft.options as option, index (index)}
                <div class="option-editor-row">
                  <input aria-label={`Option ${index + 1} text`} bind:value={option.option_text} required maxlength="2000" placeholder={`Option ${index + 1}`} />
                  <label class="correct-option">
                    <input type={draft.question_type === 'multiple_choice' ? 'checkbox' : 'radio'} name="correct-option" checked={option.is_correct} onchange={(event) => setOptionCorrect(index, event.currentTarget.checked)} />
                    <span>Correct</span>
                  </label>
                  {#if draft.question_type !== 'true_false'}<button type="button" class="icon-action" aria-label={`Remove option ${index + 1}`} disabled={draft.options.length <= 2} onclick={() => removeOption(index)}>×</button>{/if}
                  <details class="option-extra">
                    <summary>Feedback & media</summary>
                    <label><span>Option feedback</span><input bind:value={option.feedback} placeholder="Optional feedback" /></label>
                    <label><span>Option media <small>JSON array</small></span><textarea bind:value={option.media_text} rows="2" spellcheck="false"></textarea></label>
                  </details>
                </div>
              {/each}
              {#if draft.question_type !== 'true_false'}<button type="button" class="teacher-inline-link" onclick={addOption}>+ Add answer option</button>{/if}
            </fieldset>
          {:else if draft.question_type === 'fill_blank'}
            <label><span>Accepted answers <small>One per line</small></span><textarea bind:value={draft.accepted_answers_text} rows="3" required placeholder="H2O"></textarea></label>
            <p class="question-type-help">Use one <code>___</code> marker in the prompt. Each accepted answer is matched using the rules below.</p>
            <fieldset class="text-answer-rules">
              <legend>Answer matching</legend>
              <label><input type="checkbox" bind:checked={fillCaseSensitive} /><span>Match letter case</span></label>
              <label><input type="checkbox" bind:checked={fillTrimWhitespace} /><span>Trim whitespace at the ends</span></label>
              <label><input type="checkbox" bind:checked={fillIgnoreSpaces} /><span>Ignore spaces within the answer</span></label>
            </fieldset>
          {:else if draft.question_type === 'short_answer'}
            <label><span>Accepted answers <small>One per line</small></span><textarea bind:value={draft.accepted_answers_text} rows="3" placeholder="Add each accepted answer on a new line"></textarea></label>
          {:else if draft.question_type === 'matching'}
            <div class="matching-authoring">
              <p class="question-type-help">Write one prompt and one choice per line, then set the correct match for each prompt.</p>
              <div class="matching-authoring-lists">
                <label><span>Prompts <small>One per line</small></span><textarea bind:value={matchingPromptsText} rows="5" required placeholder="frog&#10;eagle"></textarea></label>
                <label><span>Choices <small>One per line</small></span><textarea bind:value={matchingChoicesText} rows="5" required placeholder="amphibian&#10;bird&#10;mammal"></textarea></label>
              </div>
              {#if matchingPrompts.length}
                <fieldset class="matching-answer-key">
                  <legend>Correct matches</legend>
                  {#each matchingPrompts as prompt, promptIndex (promptIndex)}
                    <label class="matching-answer-key-row">
                      <span>{prompt}</span>
                      <select
                        aria-label={`Correct match for ${prompt}`}
                        value={matchingCorrectAnswer(prompt)}
                        onchange={(event) => setMatchingCorrectAnswer(prompt, event.currentTarget.value)}
                        required
                      >
                        <option value="">Choose the correct choice…</option>
                        {#each matchingChoices as choice, choiceIndex (choiceIndex)}<option value={choice}>{choice}</option>{/each}
                      </select>
                    </label>
                  {/each}
                </fieldset>
              {/if}
            </div>
          {:else if draft.question_type === 'hotspot'}
            <label><span>Image URL <small>Externally hosted image</small></span><input bind:value={draft.image_url} type="url" required placeholder="https://…" /></label>
            {#if draft.image_url}
              <div
                class="hotspot-author-preview"
                role="button"
                tabindex="0"
                aria-label="Hotspot target preview. Click to set the correct point or use arrow keys to move it. Hold Shift to move by a larger step."
                onclick={setHotspotAuthorTarget}
                onkeydown={moveHotspotAuthorTarget}
              >
                <img src={draft.image_url} alt="Hotspot target preview" />
                <span
                  class="hotspot-author-marker"
                  style={`left: ${Number(hotspotTargetX) * 100}%; top: ${Number(hotspotTargetY) * 100}%`}
                  aria-hidden="true"
                ></span>
              </div>
              <p class="question-type-help">Click the image to place the correct target. Coordinates use the image’s natural aspect ratio.</p>
            {/if}
            <div class="editor-form-pair hotspot-coordinate-fields">
              <label><span>Target X <small>0–1</small></span><input bind:value={hotspotTargetX} type="number" min="0" max="1" step="0.001" required /></label>
              <label><span>Target Y <small>0–1</small></span><input bind:value={hotspotTargetY} type="number" min="0" max="1" step="0.001" required /></label>
            </div>
            <label><span>Tolerance <small>Normalized image distance</small></span><input bind:value={hotspotTolerance} type="number" min="0" step="0.001" required /></label>
          {:else if draft.question_type === 'numeric'}
            <div class="config-editor">
              <label><span>Answer configuration <small>JSON object</small></span><textarea bind:value={answerConfigText} rows="5" spellcheck="false"></textarea></label>
              <p>Example: <code>{"{\"correct_value\": 4, \"tolerance\": 0.1, \"unit\": \"cm\"}"}</code></p>
            </div>
          {:else}
            <div class="config-editor">
              <label><span>Answer configuration <small>JSON object</small></span><textarea bind:value={answerConfigText} rows="5" spellcheck="false"></textarea></label>
              <label><span>Interaction configuration <small>JSON object</small></span><textarea bind:value={interactionConfigText} rows="4" spellcheck="false"></textarea></label>
              <p>Define response interaction details and the correct answer shape in JSON for this response type.</p>
            </div>
          {/if}

          <details class="advanced-question-fields">
            <summary>Feedback, media and question details</summary>
            <div class="advanced-question-grid">
              <label><span>Feedback after submission</span><textarea bind:value={draft.feedback} rows="2"></textarea></label>
              <label><span>Worked solution</span><textarea bind:value={draft.worked_solution} rows="2"></textarea></label>
              <label><span>Tags <small>Comma separated</small></span><input bind:value={tagText} placeholder="algebra, revision" /></label>
              <label><span>Difficulty</span><select bind:value={draft.difficulty}><option value="">Not set</option>{#each [1, 2, 3, 4, 5] as level}<option value={level}>{level}</option>{/each}</select></label>
              <label><span>Curriculum standard</span><input bind:value={draft.standard_code} maxlength="128" /></label>
              <label><span>Bloom’s level</span><select bind:value={draft.blooms_level}><option value="">Not set</option>{#each bloomsLevels as level}<option value={level}>{level}</option>{/each}</select></label>
              <label><span>Folder path</span><input bind:value={draft.folder_path} maxlength="500" placeholder="Unit 1 / Algebra" /></label>
              <label><span>Question media <small>JSON array of URL objects</small></span><textarea bind:value={mediaText} rows="3" spellcheck="false"></textarea></label>
              <label><span>Partial credit <small>JSON object</small></span><textarea bind:value={partialCreditText} rows="3" spellcheck="false"></textarea></label>
              <label><span>Parameters <small>JSON object for {`{a}`} values</small></span><textarea bind:value={parameterConfigText} rows="3" spellcheck="false"></textarea></label>
            </div>
          </details>

          {#if isEditing && ['long_answer', 'code', 'short_answer'].includes(draft.question_type)}
            <section class="rubric-editor">
              <div class="inline-section-heading"><div><h4>Grading rubric</h4><p>Criteria points cannot exceed {draft.points}.</p></div><button type="button" class="teacher-inline-link" onclick={() => loadRubric(selectedQuestion)}>Edit rubric</button></div>
              {#if selectedRubricQuestion === selectedQuestionId}
                {#if rubricLoading}<p role="status" class="editor-muted">Loading rubric…</p>{:else}
                  {#each rubricCriteria as criterion, index (index)}
                    <div class="rubric-criterion">
                      <input bind:value={criterion.title} placeholder="Criterion title" />
                      <input bind:value={criterion.description} placeholder="Description" />
                      <input bind:value={criterion.max_points} type="number" min="0.1" step="0.1" aria-label="Criterion points" />
                      <button type="button" class="icon-action" aria-label={`Remove rubric criterion ${index + 1}`} onclick={() => removeRubricCriterion(index)}>×</button>
                    </div>
                  {/each}
                  <div class="rubric-actions">
                    <button type="button" class="teacher-inline-link" onclick={addRubricCriterion}>+ Add criterion</button>
                    <span class:rubric-over-limit={rubricTotalPoints > Number(draft.points)}>Total {rubricTotalPoints} / {draft.points} points</span>
                    <button type="button" class="teacher-secondary" onclick={saveRubric} disabled={rubricSaving}>{rubricSaving ? 'Saving…' : 'Save rubric'}</button>
                  </div>
                  {#if rubricError}<p class="teacher-error" role="alert">{rubricError}</p>{/if}
                  {#if rubricMessage}<p class="teacher-success" role="status">{rubricMessage}</p>{/if}
                {/if}
              {/if}
            </section>
          {/if}

          {#if isEditing}
            <div class="question-history-tools">
              <button type="button" class="teacher-inline-link" onclick={() => loadVersions(selectedQuestionId)}>Version history</button>
              <button type="button" class="teacher-inline-link" onclick={() => saveToBank(selectedQuestion)}>Add to bank</button>
              <button type="button" class="teacher-inline-link" onclick={() => regradeQuestion(selectedQuestion)}>Regrade submissions</button>
            </div>
            {#if versionsForQuestion === selectedQuestionId}
              {#if versionsError}<p class="teacher-error" role="alert">{versionsError}</p>{:else}
                <div class="question-version-list">{#each questionVersions as version (version.version)}<p><strong>Version {version.version}</strong><span>{new Date(version.created_at).toLocaleString()}</span></p>{/each}</div>
              {/if}
            {/if}
          {/if}
          <footer class="question-save-actions">
            {#if isEditing}<button type="button" class="teacher-secondary destructive-action" onclick={deleteQuestion} disabled={questionDeleting}>{questionDeleting ? 'Deleting…' : 'Delete'}</button>{/if}
            <span class="action-spacer"></span>
            <button type="button" class="teacher-secondary" onclick={addQuestion}>Clear</button>
            <button type="submit" class="teacher-button" disabled={questionSaving}>{questionSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add question'}</button>
          </footer>
        </form>
      </div>
    </div>
  {:else if activeTab === 'structure'}
    <section class="editor-section-panel">
      <div class="editor-section-heading"><div><h3>Quiz sections</h3><p>Arrange questions into parts, with optional timing and instructions.</p></div><button type="button" class="teacher-button" onclick={addSection}>Add section <span aria-hidden="true">+</span></button></div>
      {#if sectionsLoading}<p role="status" class="editor-muted">Loading sections…</p>{/if}
      {#if sectionsError}<p class="teacher-error" role="alert">{sectionsError}</p>{/if}
      {#if sections.length}
        {#each sections as section, sectionIndex (sectionIndex)}
          <article class="quiz-section-card">
            <div class="quiz-section-title-row"><label><span>Section title</span><input bind:value={section.title} required maxlength="200" /></label><button type="button" class="icon-action" aria-label="Remove section" onclick={() => removeSection(sectionIndex)}>×</button></div>
            <div class="editor-form-pair"><label><span>Time limit <small>Optional, minutes</small></span><input bind:value={section.time_limit_minutes} type="number" min="1" /></label><label class="checkbox-setting"><input type="checkbox" bind:checked={section.shuffle_questions} /><span>Shuffle questions in this section</span></label></div>
            <label><span>Instructions</span><textarea bind:value={section.instructions} rows="2" maxlength="10000"></textarea></label>
            <fieldset class="section-question-list"><legend>Questions in this section</legend>{#each questions as question (question.id)}<label><input type="checkbox" checked={(section.question_ids || []).map(String).includes(String(question.id))} onchange={() => toggleSectionQuestion(sectionIndex, question.id)} /><span>{question.question_text}</span></label>{/each}</fieldset>
          </article>
        {/each}
      {:else if !sectionsLoading}
        <div class="teacher-empty"><h4>No sections configured.</h4><p>Questions remain in the quiz’s default order until you add sections.</p></div>
      {/if}
      {#if sections.length}<div class="section-save-row">{#if sectionMessage}<p class="teacher-success" role="status">{sectionMessage}</p>{/if}<button type="button" class="teacher-button" onclick={saveSections} disabled={sectionsSaving}>{sectionsSaving ? 'Saving…' : 'Save structure'}</button></div>{/if}
    </section>
  {:else if activeTab === 'bank'}
    <section class="editor-section-panel">
      <div class="editor-section-heading"><div><h3>Question bank</h3><p>Reuse questions from your personal or institute banks.</p></div></div>
      {#if banksError}<p class="teacher-error" role="alert">{banksError}</p>{/if}
      <div class="bank-toolbar">
        <label><span>Choose a bank</span><select value={selectedBankId} onchange={selectBank}><option value="">Select a bank</option>{#each banks as bank (bank.id)}<option value={bank.id}>{bank.name}</option>{/each}</select></label>
        <form class="create-bank-form" onsubmit={createBank}><label><span>Create bank</span><input bind:value={bankName} required maxlength="200" placeholder="Bank name" /></label><button type="submit" class="teacher-secondary" disabled={creatingBank}>{creatingBank ? 'Creating…' : 'Create'}</button></form>
      </div>
      {#if banksLoading}<p role="status" class="editor-muted">Loading banks…</p>{/if}
      {#if selectedBankId}
        <div class="bank-filter-row"><label><span>Search questions</span><input bind:value={bankSearch} placeholder="Type at least two characters…" /></label><label><span>Filter by tag</span><input bind:value={bankTag} placeholder="Optional tag" /></label><button type="button" class="teacher-secondary" onclick={loadBankItems} disabled={bankItemsLoading}>Search bank</button></div>
        <form class="pool-pull-form" onsubmit={pullQuestionPool}><strong>Random pull</strong><label><span>Number</span><input bind:value={poolCount} type="number" min="1" max="100" /></label><label><span>Difficulty</span><select bind:value={poolDifficulty}><option value="">Any</option>{#each [1, 2, 3, 4, 5] as level}<option value={level}>{level}</option>{/each}</select></label><button type="submit" class="teacher-secondary" disabled={pullingPool}>{pullingPool ? 'Adding…' : 'Pull random questions'}</button></form>
        {#if bankItemsError}<p class="teacher-error" role="alert">{bankItemsError}</p>{/if}
        {#if bankItemsLoading}<p role="status" class="editor-muted">Searching bank…</p>{:else if bankItems.length}
          <div class="bank-question-list">{#each bankItems as item (item.id)}<article><div><h4>{item.question.question_text}</h4><p>{item.question.question_type.replaceAll('_', ' ')} · {item.question.points} pt · Version {item.version}</p></div><button type="button" class="teacher-inline-link" onclick={() => addFromBank(item)}>Add to quiz →</button></article>{/each}</div>
        {:else}<p class="editor-muted">No bank questions match these filters.</p>{/if}
      {:else if !banksLoading}<p class="editor-muted">Choose a bank or create one to get started.</p>{/if}
    </section>
  {:else}
    <section class="editor-section-panel settings-panel">
      <div class="editor-section-heading"><div><h3>Quiz settings</h3><p>Control timing, question delivery and scoring behavior.</p></div></div>
      <form class="teacher-form quiz-settings-form" onsubmit={saveSettings}>
        <label><span>Quiz title</span><input bind:value={quizSettings.title} maxlength="200" required /></label>
        <div class="editor-form-pair"><label><span>Duration in minutes</span><input bind:value={quizSettings.duration_minutes} type="number" min="1" required /></label><label><span>Questions to serve <small>Blank serves all questions</small></span><input bind:value={quizSettings.questions_to_serve} type="number" min="1" /></label></div>
        <label><span>Instructions</span><textarea bind:value={quizSettings.instructions} rows="4" maxlength="10000"></textarea></label>
        <label class="checkbox-setting"><input type="checkbox" bind:checked={quizSettings.shuffle_questions} /><span>Shuffle question order</span></label>
        <label class="checkbox-setting"><input type="checkbox" bind:checked={quizSettings.shuffle_options} /><span>Shuffle answer options</span></label>
        <label class="checkbox-setting"><input type="checkbox" bind:checked={quizSettings.allow_multiple_attempts} /><span>Allow multiple attempts</span></label>
        <label><span>Scoring policy</span><select bind:value={quizSettings.scoring_policy}><option value="latest">Latest attempt</option><option value="best">Best attempt</option><option value="average">Average attempts</option></select></label>
        {#if settingsError}<p class="teacher-error" role="alert">{settingsError}</p>{/if}
        {#if settingsMessage}<p class="teacher-success" role="status">{settingsMessage}</p>{/if}
        <button type="submit" class="teacher-button" disabled={settingsSaving}>{settingsSaving ? 'Saving…' : 'Save settings'}</button>
      </form>
    </section>
  {/if}
</section>
