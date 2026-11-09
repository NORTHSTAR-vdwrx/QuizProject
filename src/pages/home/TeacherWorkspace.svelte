<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { ApiError, apiRequest, asList, displayError, unwrap } from '../../lib/api.js';
  import QuizEditor from './QuizEditor.svelte';

  let profile = null;
  let quizzes = [];
  let sessions = [];
  let ownGroups = [];
  let visibleGroups = [];
  let loading = true;
  let error = '';
  let success = '';
  let tab = 'quizzes';
  let activeQuiz = null;
  let quizStep = 'library';
  let quizTitle = '';
  let quizDuration = 30;
  let quizSearch = '';
  let createdQuiz = null;
  let selectedGroupIds = [];
  let groupSearch = '';
  let savingQuiz = false;
  let quizError = '';
  let sessionDialog = false;
  let sessionQuizId = '';
  let editingSessionId = '';
  let sessionStartTime = '';
  let sessionEndTime = '';
  let sessionMaxAttempts = 1;
  let sessionSaving = false;
  let sessionError = '';
  let sessionListError = '';
  let sessionDialogElement;
  let rosterSession = null;
  let rosterRows = [];
  let rosterLoading = false;
  let rosterError = '';
  let selectedAttempt = null;
  let attemptReviewLoading = false;
  let attemptReviewError = '';
  let attemptRubrics = {};
  let gradeDrafts = {};
  let savingGradeQuestionId = '';
  let gradeMessage = '';
  let gradeError = '';
  let groupDialog = false;
  let groupName = '';
  let groupIsPublic = false;
  let groupSearchText = '';
  let studentMatches = [];
  let selectedStudents = [];
  let studentSearchLoading = false;
  let studentSearchError = '';
  let studentSearchCompleted = false;
  let studentSearchRequest = 0;
  let groupSaving = false;
  let groupError = '';
  let groupMessage = '';
  let groupSearchTimer;
  let groupDialogElement;
  let memberGroupId = '';
  let groupMembers = [];
  let membersLoading = false;
  let membersError = '';
  let memberSearchText = '';
  let memberMatches = [];
  let memberSearchLoading = false;
  let memberSearchError = '';
  let memberSearchTimer;

  $: currentInstituteId = profile?.institute_id ? String(profile.institute_id) : '';
  $: filteredOwnGroups = ownGroups.filter((group) =>
    group.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase())
  );
  $: publicGroups = visibleGroups.filter((group) =>
    group.is_public && !ownGroups.some((ownGroup) => ownGroup.id === group.id)
  );
  $: filteredPublicGroups = publicGroups.filter((group) =>
    group.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase())
  );
  $: filteredAssignableGroups = ownGroups.filter((group) =>
    group.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase())
  );
  $: filteredQuizzes = quizzes.filter((quiz) =>
    String(quiz.title || '').toLowerCase().includes(quizSearch.trim().toLowerCase())
  );
  $: orderedSessions = [...sessions].sort((left, right) =>
    new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
  );
  $: sessionQuiz = rosterSession
    ? quizzes.find((quiz) => String(quiz.id) === String(rosterSession.quiz_id))
    : null;
  $: availableMemberMatches = memberMatches.filter((match) =>
    !groupMembers.some((member) => String(member.user_id) === String(match.user_id))
  );

  onMount(loadWorkspace);
  onDestroy(() => {
    clearTimeout(groupSearchTimer);
    clearTimeout(memberSearchTimer);
  });

  async function loadWorkspace() {
    const results = await Promise.allSettled([
      apiRequest('/extended-users/me'),
      apiRequest('/quizzes'),
      apiRequest('/sessions'),
      apiRequest('/groups?created_by_me=true'),
      apiRequest('/groups')
    ]);

    const [profileResult, quizResult, sessionsResult, ownGroupsResult, visibleGroupsResult] = results;
    if (profileResult.status === 'fulfilled') {
      profile = unwrap(profileResult.value, 'user');
    }
    if (quizResult.status === 'fulfilled') quizzes = asList(quizResult.value);
    if (sessionsResult.status === 'fulfilled') sessions = asList(sessionsResult.value);
    if (ownGroupsResult.status === 'fulfilled') ownGroups = asList(ownGroupsResult.value);
    if (visibleGroupsResult.status === 'fulfilled') visibleGroups = asList(visibleGroupsResult.value);

    const missingProfile = profileResult.status === 'rejected'
      && profileResult.reason instanceof ApiError
      && profileResult.reason.status === 404
      && /Extended user profile not found/i.test(profileResult.reason.message);
    const failures = results.slice(1).filter((result) => result.status === 'rejected');
    if (profileResult.status === 'rejected' && !missingProfile) failures.unshift(profileResult);
    if (failures.length) {
      error = failures.map((result) => displayError(result.reason, 'A teaching workspace section could not be loaded.')).join(' ');
    }
    loading = false;
    await animateEntrance();
  }

  function localDateTimeValue(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function sessionInputToIso(value) {
    return new Date(value).toISOString();
  }

  function sessionDateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function sessionStatus(session) {
    const now = Date.now();
    const start = new Date(session.start_time).getTime();
    const end = new Date(session.end_time).getTime();
    if (now < start) return 'Upcoming';
    if (now >= end) return 'Closed';
    return 'Open';
  }

  async function focusSessionDialog() {
    await tick();
    sessionDialogElement?.focus();
    const gsap = window.gsap;
    if (gsap && sessionDialogElement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(sessionDialogElement, { autoAlpha: 0, y: 8 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.22,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility'
      });
    }
  }

  async function openScheduleDialog(quiz) {
    const now = new Date(Date.now() + 10 * 60000);
    now.setSeconds(0, 0);
    const end = new Date(now.getTime() + 60 * 60000);
    sessionQuizId = String(quiz.id);
    editingSessionId = '';
    sessionStartTime = localDateTimeValue(now);
    sessionEndTime = localDateTimeValue(end);
    sessionMaxAttempts = 1;
    sessionError = '';
    sessionDialog = true;
    await focusSessionDialog();
  }

  async function openEditSession(session) {
    sessionQuizId = String(session.quiz_id);
    editingSessionId = String(session.id);
    sessionStartTime = localDateTimeValue(session.start_time);
    sessionEndTime = localDateTimeValue(session.end_time);
    sessionMaxAttempts = Number(session.max_attempts) || 1;
    sessionError = '';
    sessionDialog = true;
    await focusSessionDialog();
  }

  function closeSessionDialog() {
    if (sessionSaving) return;
    sessionDialog = false;
    sessionError = '';
  }

  function handleSessionDialogKeydown(event) {
    if (event.key === 'Escape') closeSessionDialog();
  }

  async function saveSession(event) {
    event.preventDefault();
    sessionError = '';
    const start = new Date(sessionStartTime);
    const end = new Date(sessionEndTime);
    if (!sessionStartTime || !sessionEndTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      sessionError = 'Enter a valid start and end time.';
      return;
    }
    if (end <= start) {
      sessionError = 'The end time must be later than the start time.';
      return;
    }
    const maxAttempts = Number(sessionMaxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      sessionError = 'Allow at least one attempt.';
      return;
    }

    sessionSaving = true;
    const body = {
      start_time: sessionInputToIso(sessionStartTime),
      end_time: sessionInputToIso(sessionEndTime),
      max_attempts: selectedQuizAllowsMultipleAttempts() ? maxAttempts : 1
    };
    if (!editingSessionId) body.quiz_id = sessionQuizId;
    try {
      const result = await apiRequest(
        editingSessionId
          ? `/sessions/${encodeURIComponent(editingSessionId)}`
          : '/sessions',
        {
          method: editingSessionId ? 'PATCH' : 'POST',
          body: JSON.stringify(body)
        }
      );
      const savedSession = unwrap(result, 'session');
      sessions = editingSessionId
        ? sessions.map((session) => String(session.id) === editingSessionId ? savedSession : session)
        : [...sessions, savedSession];
      success = editingSessionId ? 'Assessment schedule updated.' : 'Assessment scheduled.';
      sessionDialog = false;
    } catch (requestError) {
      sessionError = displayError(requestError, 'Could not save this assessment schedule.');
    } finally {
      sessionSaving = false;
    }
  }

  function selectedQuizAllowsMultipleAttempts() {
    return Boolean(quizzes.find((quiz) => String(quiz.id) === sessionQuizId)?.allow_multiple_attempts);
  }

  async function deleteSession(session) {
    if (!window.confirm(`Cancel the scheduled assessment for “${session.quiz_title || 'this quiz'}”?`)) return;
    sessionListError = '';
    try {
      await apiRequest(`/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      sessions = sessions.filter((item) => String(item.id) !== String(session.id));
      success = 'Scheduled assessment cancelled.';
    } catch (requestError) {
      sessionListError = displayError(requestError, 'Could not cancel this assessment.');
    }
  }

  async function openSessionRoster(session) {
    rosterSession = session;
    rosterRows = [];
    rosterLoading = true;
    rosterError = '';
    selectedAttempt = null;
    attemptReviewError = '';
    gradeMessage = '';
    gradeError = '';
    try {
      const groupIds = sessionQuizFor(session)?.group_ids || [];
      const [attemptResult, ...memberResults] = await Promise.all([
        loadAllSessionAttempts(session.id),
        ...groupIds.map((groupId) => apiRequest(`/groups/${encodeURIComponent(groupId)}/members`))
      ]);
      const membersById = new Map();
      for (const result of memberResults) {
        for (const member of asList(result)) {
          if (member.role === 'student' && member.user_id) membersById.set(String(member.user_id), member);
        }
      }
      const attemptsByStudent = new Map();
      for (const attempt of asList(attemptResult)) {
        const studentId = String(attempt.student_id || '');
        if (!studentId) continue;
        const previous = attemptsByStudent.get(studentId);
        if (!previous || Number(attempt.attempt_number || 1) > Number(previous.attempt_number || 1)) {
          attemptsByStudent.set(studentId, attempt);
        }
      }
      rosterRows = [...membersById.values()]
        .map((student) => ({
          student,
          attempt: attemptsByStudent.get(String(student.user_id)) || null
        }))
        .sort((left, right) => String(left.student.username || '').localeCompare(String(right.student.username || '')));
    } catch (requestError) {
      rosterError = displayError(requestError, 'Could not load the students and attempt status for this exam.');
    } finally {
      rosterLoading = false;
    }
  }

  function sessionQuizFor(session) {
    return quizzes.find((quiz) => String(quiz.id) === String(session.quiz_id));
  }

  function studentAttemptStatus(attempt) {
    if (!attempt) return 'Not started';
    if (attempt.status === 'in_progress') return 'In progress';
    if (attempt.status === 'submitted' && !attempt.grading_complete) return 'Awaiting grading';
    if (attempt.status === 'submitted') return 'Graded';
    return attempt.status || 'Unknown';
  }

  function studentAttemptProgress(attempt) {
    if (!attempt) return '—';
    const questions = attempt.questions || [];
    const total = questions.length;
    if (!total) return '—';
    const answers = new Map((attempt.answers || []).map((answer) => [String(answer.question_id), answer]));
    const answered = questions.filter((question) => {
      const answer = answers.get(String(question.id));
      if (!answer) return false;
      if (question.question_type === 'matching') {
        return Object.values(answer.answer_data?.value || {}).some((value) => String(value).trim());
      }
      if (question.question_type === 'hotspot') {
        return Number.isFinite(Number(answer.answer_data?.x)) && Number.isFinite(Number(answer.answer_data?.y));
      }
      return Boolean(
        answer.selected_option_ids?.length
        || (typeof answer.text_answer === 'string' && answer.text_answer.trim())
        || (question.question_type === 'numeric' && String(answer.answer_data?.value ?? '').trim())
        || (question.question_type === 'code' && String(answer.answer_data?.code ?? '').trim())
        || Object.keys(answer.answer_data || {}).length
      );
    }).length;
    return `${answered} / ${total}`;
  }

  function manualGradeQuestions(attempt) {
    return (attempt?.questions || []).filter((question) =>
      ['short_answer', 'long_answer', 'code'].includes(question.question_type)
    );
  }

  function answerForQuestion(attempt, questionId) {
    return attempt?.answers?.find((answer) => String(answer.question_id) === String(questionId));
  }

  function answerDisplay(answer) {
    if (!answer) return 'No response';
    if (answer.text_answer) return answer.text_answer;
    if (answer.selected_option_ids?.length) return `${answer.selected_option_ids.length} option${answer.selected_option_ids.length === 1 ? '' : 's'} selected`;
    if (answer.answer_data && Object.keys(answer.answer_data).length) return JSON.stringify(answer.answer_data, null, 2);
    return 'No response';
  }

  function rubricFeedbackParts(feedback, criteria) {
    const text = String(feedback || '');
    const match = /^Rubric scores: ([^\r\n]*)/m.exec(text);
    if (!match) return { scores: {}, feedback: text };
    const scores = {};
    for (const entry of match[1].split(';')) {
      const parsed = /^(\d+)\..*:\s*([0-9]+(?:\.[0-9]+)?)\s*\//.exec(entry.trim());
      if (parsed) scores[Number(parsed[1]) - 1] = Number(parsed[2]);
    }
    return {
      scores: Object.fromEntries(criteria.map((_, index) => [index, scores[index] ?? 0])),
      feedback: text.slice(match[0].length).replace(/^\s*\n?/, '')
    };
  }

  async function openAttemptReview(attemptSummary) {
    selectedAttempt = null;
    attemptRubrics = {};
    gradeDrafts = {};
    attemptReviewError = '';
    gradeError = '';
    gradeMessage = '';
    attemptReviewLoading = true;
    try {
      const attempt = unwrap(await apiRequest(`/attempts/${encodeURIComponent(attemptSummary.id)}`), 'attempt');
      selectedAttempt = {
        ...attempt,
        student_id: attemptSummary.student_id,
        student_name: attemptSummary.student_name || attempt.student_name,
        student_email: attemptSummary.student_email || attempt.student_email,
        attempt_number: attemptSummary.attempt_number || attempt.attempt_number
      };
      const questions = manualGradeQuestions(attempt);
      const rubricResults = await Promise.allSettled(questions.map((question) =>
        apiRequest(`/questions/${encodeURIComponent(question.id)}/rubric`)
      ));
      const loadFailures = rubricResults.filter((result) => result.status === 'rejected');
      if (loadFailures.length) {
        throw new Error(loadFailures.map((result) => displayError(result.reason, 'Could not load a question rubric.')).join(' '));
      }
      attemptRubrics = Object.fromEntries(questions.map((question, index) => [
        String(question.id),
        asList(rubricResults[index].value)
      ]));
      gradeDrafts = Object.fromEntries(questions.map((question) => {
        const criteria = attemptRubrics[String(question.id)] || [];
        const answer = answerForQuestion(attempt, question.id);
        const parsed = rubricFeedbackParts(answer?.grader_feedback, criteria);
        return [String(question.id), {
          scores: parsed.scores,
          feedback: parsed.feedback,
          points: answer?.points_awarded ?? 0
        }];
      }));
    } catch (requestError) {
      attemptReviewError = displayError(requestError, 'Could not open this student attempt.');
    } finally {
      attemptReviewLoading = false;
    }
  }

  function setRubricScore(questionId, index, value) {
    const draft = gradeDrafts[questionId] || { scores: {}, feedback: '', points: 0 };
    const rubric = attemptRubrics[questionId] || [];
    const scores = { ...draft.scores, [index]: Number(value) };
    const points = rubric.reduce((total, criterion, criterionIndex) =>
      total + (Number(scores[criterionIndex]) || 0), 0
    );
    gradeDrafts = { ...gradeDrafts, [questionId]: { ...draft, scores, points } };
  }

  function setGradeFeedback(questionId, feedback) {
    gradeDrafts = {
      ...gradeDrafts,
      [questionId]: { ...gradeDrafts[questionId], feedback }
    };
  }

  async function saveManualGrade(question) {
    const questionId = String(question.id);
    const draft = gradeDrafts[questionId] || { scores: {}, feedback: '', points: 0 };
    const rubric = attemptRubrics[questionId] || [];
    const points = rubric.length
      ? rubric.reduce((total, _, index) => total + (Number(draft.scores[index]) || 0), 0)
      : Number(draft.points) || 0;
    if (points > Number(question.points)) {
      gradeError = `The rubric score for this question cannot exceed ${question.points} points.`;
      return;
    }
    if (rubric.some((criterion, index) =>
      !Number.isFinite(Number(draft.scores[index]))
      || Number(draft.scores[index]) < 0
      || Number(draft.scores[index]) > Number(criterion.max_points)
    )) {
      gradeError = 'Each rubric score must be between zero and that criterion’s maximum.';
      return;
    }
    const rubricLine = rubric.length
      ? `Rubric scores: ${rubric.map((criterion, index) =>
        `${index + 1}. ${criterion.title}: ${Number(draft.scores[index]) || 0}/${criterion.max_points}`
      ).join('; ')}`
      : '';
    const feedback = [rubricLine, String(draft.feedback || '').trim()].filter(Boolean).join('\n');
    savingGradeQuestionId = questionId;
    gradeError = '';
    gradeMessage = '';
    try {
      await apiRequest(`/attempts/${encodeURIComponent(selectedAttempt.id)}/grades/${encodeURIComponent(questionId)}`, {
        method: 'PUT',
        body: JSON.stringify({ points_awarded: points, feedback: feedback || null })
      });
      selectedAttempt = {
        ...selectedAttempt,
        answers: (selectedAttempt.answers || []).map((answer) =>
          String(answer.question_id) === questionId
            ? { ...answer, points_awarded: points, grader_feedback: feedback || null }
            : answer
        )
      };
      gradeMessage = 'Grade saved.';
      try {
        const refreshedAttempts = await loadAllSessionAttempts(rosterSession.id);
        const latestByStudent = new Map();
        for (const attempt of refreshedAttempts) {
          const studentId = String(attempt.student_id || '');
          const previous = latestByStudent.get(studentId);
          if (!previous || Number(attempt.attempt_number || 1) > Number(previous.attempt_number || 1)) {
            latestByStudent.set(studentId, attempt);
          }
        }
        rosterRows = rosterRows.map((row) => ({
          ...row,
          attempt: latestByStudent.get(String(row.student.user_id)) || null
        }));
      } catch (refreshError) {
        rosterError = `Grade saved, but status could not refresh: ${displayError(refreshError, 'Refresh the page to see the update.')}`;
      }
    } catch (requestError) {
      gradeError = displayError(requestError, 'Could not save this grade.');
    } finally {
      savingGradeQuestionId = '';
    }
  }

  async function loadAllSessionAttempts(sessionId) {
    const pageSize = 500;
    const attempts = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = asList(await apiRequest(
        `/sessions/${encodeURIComponent(sessionId)}/attempts?limit=${pageSize}&offset=${offset}`
      ));
      attempts.push(...page);
      if (page.length < pageSize) return attempts;
    }
  }

  async function animateEntrance() {
    await tick();
    const gsap = window.gsap;
    const items = document.querySelectorAll('.teacher-workspace-heading, .teacher-content');
    if (!gsap || !items.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(items, { autoAlpha: 0, y: 9 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.34,
      stagger: 0.06,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    });
  }

  async function animateGroupDialog() {
    await tick();
    const gsap = window.gsap;
    if (!gsap || !groupDialogElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const backdrop = groupDialogElement.parentElement;
    const timeline = gsap.timeline();
    timeline.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, ease: 'power1.out' });
    timeline.fromTo(groupDialogElement, { autoAlpha: 0, y: 8 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    }, '-=0.06');
    groupDialogElement.querySelector('input')?.focus();
  }

  async function createQuiz(event) {
    event.preventDefault();
    quizError = '';
    if (!currentInstituteId) {
      quizError = 'Complete your teacher profile and select an institute before creating a quiz.';
      return;
    }
    savingQuiz = true;
    try {
      const result = await apiRequest('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: quizTitle.trim(),
          duration_minutes: Number(quizDuration)
        })
      });
      createdQuiz = unwrap(result, 'quiz');
      if (!createdQuiz.id) throw new Error('The quiz was created, but the response did not include its ID.');
      quizzes = [createdQuiz, ...quizzes.filter((quiz) => quiz.id !== createdQuiz.id)];
      selectedGroupIds = [];
      quizStep = 'groups';
      success = '';
      await animateEntrance();
    } catch (requestError) {
      quizError = displayError(requestError, 'Could not create the quiz.');
    } finally {
      savingQuiz = false;
    }
  }

  function startQuizCreation() {
    quizError = '';
    quizTitle = '';
    quizDuration = 30;
    quizStep = 'create';
  }

  function toggleQuizGroup(groupId) {
    const id = String(groupId);
    selectedGroupIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter((selectedId) => selectedId !== id)
      : [...selectedGroupIds, id];
  }

  async function saveQuizGroups() {
    if (!createdQuiz?.id) return;
    savingQuiz = true;
    quizError = '';
    try {
      const result = await apiRequest(`/quizzes/${encodeURIComponent(createdQuiz.id)}/groups`, {
        method: 'PUT',
        body: JSON.stringify({ group_ids: selectedGroupIds })
      });
      createdQuiz = unwrap(result, 'quiz');
      quizzes = quizzes.map((quiz) => quiz.id === createdQuiz.id ? createdQuiz : quiz);
      quizStep = 'done';
      success = `${createdQuiz.title} is saved${selectedGroupIds.length ? ' and assigned to selected groups' : ''}.`;
    } catch (requestError) {
      quizError = displayError(requestError, 'Could not assign these groups to the quiz.');
    } finally {
      savingQuiz = false;
    }
  }

  function beginAnotherQuiz() {
    quizStep = 'library';
    quizTitle = '';
    quizDuration = 30;
    createdQuiz = null;
    selectedGroupIds = [];
    quizError = '';
    success = '';
  }

  async function startGroupCreation(context = 'library') {
    clearTimeout(groupSearchTimer);
    studentSearchRequest += 1;
    groupDialog = true;
    groupContext = context;
    groupName = '';
    groupIsPublic = false;
    groupSearchText = '';
    studentMatches = [];
    selectedStudents = [];
    studentSearchLoading = false;
    studentSearchCompleted = false;
    groupError = '';
    groupMessage = '';
    studentSearchError = '';
    await animateGroupDialog();
  }

  let groupContext = 'library';

  async function closeGroupDialog() {
    if (groupSaving) return;
    studentSearchRequest += 1;
    clearTimeout(groupSearchTimer);
    const gsap = window.gsap;
    if (gsap && groupDialogElement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await new Promise((resolve) => {
        gsap.to(groupDialogElement.parentElement, {
          autoAlpha: 0,
          duration: 0.14,
          ease: 'power1.in',
          onComplete: resolve
        });
      });
    }
    groupDialog = false;
  }

  function searchStudents(event) {
    groupSearchText = event.currentTarget.value;
    clearTimeout(groupSearchTimer);
    studentSearchError = '';
    studentSearchCompleted = false;
    studentSearchRequest += 1;
    studentMatches = [];
    if (groupSearchText.trim().length < 2) {
      studentSearchLoading = false;
      return;
    }
    studentSearchLoading = true;
    groupSearchTimer = setTimeout(() => loadStudentMatches(groupSearchText), 260);
  }

  async function loadStudentMatches(search) {
    const requestId = ++studentSearchRequest;
    const requestedTerm = search.trim();
    studentSearchLoading = true;
    studentSearchError = '';
    try {
      const result = await apiRequest(`/groups/students?search=${encodeURIComponent(requestedTerm)}&limit=30`);
      if (requestId !== studentSearchRequest || requestedTerm !== groupSearchText.trim()) return;
      studentMatches = asList(result).filter((student) => student.user_id || student.id);
      studentSearchCompleted = true;
    } catch (requestError) {
      if (requestId !== studentSearchRequest) return;
      studentSearchError = displayError(requestError, 'Could not search institute students.');
    } finally {
      if (requestId === studentSearchRequest) studentSearchLoading = false;
    }
  }

  function studentId(student) {
    return String(student.user_id || student.id || '');
  }

  function studentName(student) {
    return student.acc_name || student.name || student.display_name || student.username || student.email || 'Student';
  }

  function toggleStudent(student) {
    const id = studentId(student);
    if (!id) return;
    if (selectedStudents.some((item) => studentId(item) === id)) {
      selectedStudents = selectedStudents.filter((item) => studentId(item) !== id);
    } else {
      selectedStudents = [...selectedStudents, student];
    }
  }

  async function createGroup(event) {
    event.preventDefault();
    groupSaving = true;
    groupError = '';
    groupMessage = '';
    try {
      const result = await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({
          group_name: groupName.trim(),
          is_public: groupIsPublic
        })
      });
      const group = unwrap(result, 'group');
      if (!group.id) throw new Error('The group was created, but the response did not include its ID.');
      ownGroups = [group, ...ownGroups];
      visibleGroups = [group, ...visibleGroups.filter((item) => item.id !== group.id)];

      const addResults = await Promise.allSettled(selectedStudents.map((student) =>
        apiRequest(`/groups/${encodeURIComponent(group.id)}/members`, {
          method: 'POST',
          body: JSON.stringify({ user_id: student.user_id || student.id })
        })
      ));
      const addedCount = addResults.filter((item) => item.status === 'fulfilled').length;
      const failedCount = addResults.length - addedCount;
      ownGroups = ownGroups.map((item) => item.id === group.id ? { ...item, member_count: addedCount } : item);
      visibleGroups = visibleGroups.map((item) => item.id === group.id ? { ...item, member_count: addedCount } : item);

      if (groupContext === 'quiz') {
        selectedGroupIds = [...new Set([...selectedGroupIds, String(group.id)])];
      }

      groupDialog = false;
      if (groupContext === 'library') tab = 'my-groups';
      success = failedCount
        ? `“${group.group_name}” was created; ${addedCount} of ${selectedStudents.length} students were added. Review the group and add any missing students.`
        : `“${group.group_name}” created${addedCount ? ` with ${addedCount} students` : ''}.`;
      if (failedCount) {
        error = `${failedCount} student${failedCount === 1 ? '' : 's'} could not be added.`;
      }
    } catch (requestError) {
      groupError = displayError(requestError, 'Could not create this group.');
    } finally {
      groupSaving = false;
    }
  }

  async function showMembers(group) {
    memberGroupId = String(group.id);
    membersLoading = true;
    membersError = '';
    try {
      groupMembers = asList(await apiRequest(`/groups/${encodeURIComponent(group.id)}/members`));
    } catch (requestError) {
      membersError = displayError(requestError, 'Could not load this group’s members.');
      groupMembers = [];
    } finally {
      membersLoading = false;
    }
  }

  function searchMembers(event) {
    memberSearchText = event.currentTarget.value;
    clearTimeout(memberSearchTimer);
    memberSearchError = '';
    if (memberSearchText.trim().length < 2) {
      memberMatches = [];
      memberSearchLoading = false;
      return;
    }
    memberSearchTimer = setTimeout(() => loadMemberMatches(memberSearchText), 260);
  }

  async function loadMemberMatches(search) {
    memberSearchLoading = true;
    memberSearchError = '';
    try {
      memberMatches = asList(await apiRequest(`/groups/students?search=${encodeURIComponent(search.trim())}`));
    } catch (requestError) {
      memberSearchError = displayError(requestError, 'Could not search institute students.');
    } finally {
      memberSearchLoading = false;
    }
  }

  async function addMember(student) {
    const id = String(student.user_id || student.id);
    try {
      await apiRequest(`/groups/${encodeURIComponent(memberGroupId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: id })
      });
      groupMembers = [...groupMembers, {
        user_id: id,
        username: student.username,
        email: student.email,
        role: 'student'
      }];
      ownGroups = ownGroups.map((group) => group.id === memberGroupId
        ? { ...group, member_count: (group.member_count || 0) + 1 }
        : group);
      memberMatches = memberMatches.filter((match) => String(match.user_id || match.id) !== id);
    } catch (requestError) {
      memberSearchError = displayError(requestError, 'Could not add this student.');
    }
  }

  async function removeMember(student) {
    try {
      await apiRequest(`/groups/${encodeURIComponent(memberGroupId)}/members/${encodeURIComponent(student.user_id)}`, {
        method: 'DELETE'
      });
      groupMembers = groupMembers.filter((member) => member.user_id !== student.user_id);
      ownGroups = ownGroups.map((group) => group.id === memberGroupId
        ? { ...group, member_count: Math.max(0, (group.member_count || 0) - 1) }
        : group);
    } catch (requestError) {
      membersError = displayError(requestError, 'Could not remove this student.');
    }
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Delete “${group.group_name}”? This also removes its memberships and quiz assignments.`)) return;
    try {
      await apiRequest(`/groups/${encodeURIComponent(group.id)}`, { method: 'DELETE' });
      ownGroups = ownGroups.filter((item) => item.id !== group.id);
      visibleGroups = visibleGroups.filter((item) => item.id !== group.id);
      selectedGroupIds = selectedGroupIds.filter((id) => id !== String(group.id));
      if (memberGroupId === String(group.id)) memberGroupId = '';
      success = `“${group.group_name}” deleted.`;
    } catch (requestError) {
      error = displayError(requestError, 'Could not delete this group.');
    }
  }

  function groupLabel(group) {
    return group.group_name || 'Untitled group';
  }

  function updateQuizInLibrary(updatedQuiz) {
    quizzes = quizzes.map((item) => item.id === updatedQuiz.id ? updatedQuiz : item);
  }
</script>

{#if loading}
  <p class="page-copy" role="status">Preparing your teaching space…</p>
{:else}
  <section class="teacher-workspace-heading">
    <div>
      <h2>Your teaching workspace</h2>
      <p>{profile?.institute_id ? 'Create assessments and organize classes at your institute.' : 'Create assessments and organize your classes.'}</p>
    </div>
  </section>

  {#if error}<p class="teacher-notice teacher-error" role="alert">{error}</p>{/if}
  {#if success}<p class="teacher-notice teacher-success" role="status">{success}</p>{/if}

  {#if activeQuiz}
    <QuizEditor
      quiz={activeQuiz}
      onBack={() => (activeQuiz = null)}
      onQuizUpdated={updateQuizInLibrary}
    />
  {:else}
  <section class="teacher-content">
    <nav class="teacher-tabs" aria-label="Teaching workspace">
      <button class:tab-active={tab === 'quizzes'} type="button" onclick={() => (tab = 'quizzes')}>Quizzes <span>{quizzes.length}</span></button>
      <button class:tab-active={tab === 'my-groups'} type="button" onclick={() => (tab = 'my-groups')}>Created groups <span>{ownGroups.length}</span></button>
      <button class:tab-active={tab === 'public-groups'} type="button" onclick={() => (tab = 'public-groups')}>Institute groups <span>{publicGroups.length}</span></button>
    </nav>

    {#if tab === 'quizzes'}
      {#if quizStep === 'library'}
        <div class="quiz-library-toolbar">
          <label class="teacher-search-field">
            <span>Search quizzes</span>
            <input bind:value={quizSearch} type="search" placeholder="Find a quiz by title…" />
          </label>
          <button type="button" class="teacher-button" onclick={startQuizCreation} disabled={!currentInstituteId}>
            Create quiz <span aria-hidden="true">+</span>
          </button>
        </div>
        {#if sessionListError}<p class="teacher-notice teacher-error" role="alert">{sessionListError}</p>{/if}
        {#if sessions.length}
          <section class="teacher-sessions" aria-labelledby="teacher-sessions-title">
            <div class="teacher-list-heading">
              <div><h3 id="teacher-sessions-title">Scheduled exams</h3><p>Manage access windows for your quizzes.</p></div>
              <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
            </div>
            <div class="teacher-session-list">
              {#each orderedSessions as session (session.id)}
                <article class="teacher-session-row">
                  <div class="teacher-session-info">
                    <span class="teacher-session-status" class:session-open={sessionStatus(session) === 'Open'}>{sessionStatus(session)}</span>
                    <h4>{session.quiz_title || 'Quiz assessment'}</h4>
                    <p>{sessionDateLabel(session.start_time)} – {sessionDateLabel(session.end_time)}</p>
                    <small>Join code <strong>{session.join_code}</strong> · {session.max_attempts} {session.max_attempts === 1 ? 'attempt' : 'attempts'} allowed</small>
                  </div>
                  <div class="teacher-session-actions">
                    <button type="button" class="teacher-secondary" onclick={() => openSessionRoster(session)}>Students</button>
                    <button type="button" class="teacher-secondary" onclick={() => openEditSession(session)}>Edit</button>
                    <button type="button" class="teacher-session-cancel" onclick={() => deleteSession(session)}>Cancel</button>
                  </div>
                </article>
              {/each}
            </div>
            {#if rosterSession}
              <section class="session-roster-panel" aria-labelledby="session-roster-title">
                <header class="session-roster-heading">
                  <div>
                    <button type="button" class="teacher-back" onclick={() => (rosterSession = null)}>← Scheduled exams</button>
                    <h4 id="session-roster-title">{rosterSession.quiz_title || 'Exam'} · student status</h4>
                    <p>{rosterRows.length} assigned student{rosterRows.length === 1 ? '' : 's'}</p>
                  </div>
                  <button type="button" class="teacher-secondary" onclick={() => openSessionRoster(rosterSession)} disabled={rosterLoading}>
                    {rosterLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </header>
                {#if rosterLoading}<p class="teacher-empty-line" role="status">Loading class status…</p>{/if}
                {#if rosterError}<p class="teacher-error" role="alert">{rosterError}</p>{/if}
                {#if !rosterLoading && !rosterError && !rosterRows.length}
                  <p class="teacher-empty-line">No students are assigned to the groups for this quiz.</p>
                {:else if rosterRows.length}
                  <div class="student-status-table-wrap">
                    <table class="student-status-table">
                      <thead><tr><th>Student</th><th>Status</th><th>Progress</th><th>Score</th><th></th></tr></thead>
                      <tbody>
                        {#each rosterRows as row (row.student.user_id)}
                          <tr>
                            <td><strong>{row.student.username}</strong><small>{row.student.email}</small></td>
                            <td><span class="student-status-pill" class:status-progress={studentAttemptStatus(row.attempt) === 'In progress'} class:status-pending={studentAttemptStatus(row.attempt) === 'Awaiting grading'} class:status-complete={studentAttemptStatus(row.attempt) === 'Graded'}>{studentAttemptStatus(row.attempt)}</span></td>
                            <td>{studentAttemptProgress(row.attempt)}</td>
                            <td>{row.attempt?.score != null && row.attempt?.max_score ? `${Math.round(row.attempt.score / row.attempt.max_score * 100)}%` : '—'}</td>
                            <td>
                              {#if row.attempt?.status === 'submitted'}
                                <button type="button" class="quiet-action" onclick={() => openAttemptReview(row.attempt)}>
                                  {row.attempt.grading_complete ? 'Review' : 'Review & grade'} →
                                </button>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                {#if attemptReviewLoading}<p class="teacher-empty-line" role="status">Loading student responses and rubrics…</p>{/if}
                {#if attemptReviewError}<p class="teacher-error" role="alert">{attemptReviewError}</p>{/if}
                {#if selectedAttempt}
                  <section class="attempt-review" aria-label="Student attempt review">
                    <header class="attempt-review-heading">
                      <div>
                        <h5>{selectedAttempt.student_name || 'Student'} · attempt {selectedAttempt.attempt_number || 1}</h5>
                        <p>{selectedAttempt.student_email || ''} · started {sessionDateLabel(selectedAttempt.started_at)}</p>
                      </div>
                      <button type="button" class="teacher-inline-link" onclick={() => (selectedAttempt = null)}>Close review</button>
                    </header>
                    {#each selectedAttempt.questions || [] as question (question.id)}
                      {@const answer = answerForQuestion(selectedAttempt, question.id)}
                      <article class="review-question">
                        <div class="review-question-prompt">
                          <strong>{question.question_text}</strong>
                          <span>{question.points} points · {question.question_type.replaceAll('_', ' ')}</span>
                        </div>
                        <pre class="review-student-answer">{answerDisplay(answer)}</pre>
                        {#if ['short_answer', 'long_answer', 'code'].includes(question.question_type)}
                          {@const criteria = attemptRubrics[String(question.id)] || []}
                          {@const draft = gradeDrafts[String(question.id)] || { scores: {}, feedback: '', points: 0 }}
                          {#if criteria.length}
                            <div class="attempt-rubric">
                              <h6>Rubric</h6>
                              {#each criteria as criterion, index (index)}
                                <label class="attempt-rubric-row">
                                  <span><strong>{criterion.title}</strong><small>{criterion.description || 'No description'} · up to {criterion.max_points} points</small></span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={criterion.max_points}
                                    step="0.1"
                                    aria-label={`${criterion.title} score`}
                                    value={draft.scores[index] ?? 0}
                                    oninput={(event) => setRubricScore(String(question.id), index, event.currentTarget.value)}
                                  />
                                </label>
                              {/each}
                              <p class="attempt-rubric-total">Rubric total <strong>{draft.points || 0} / {question.points}</strong></p>
                            </div>
                          {:else}
                            <p class="teacher-empty-line">No rubric criteria have been added to this question. Enter a manual score below.</p>
                          {/if}
                          <div class="manual-grade-controls">
                            <label><span>Points awarded</span><input type="number" min="0" max={question.points} step="0.1" value={criteria.length ? draft.points : draft.points || 0} oninput={(event) => gradeDrafts = { ...gradeDrafts, [String(question.id)]: { ...draft, points: Number(event.currentTarget.value) } }} /></label>
                            <label><span>Feedback</span><textarea rows="2" value={draft.feedback} oninput={(event) => setGradeFeedback(String(question.id), event.currentTarget.value)}></textarea></label>
                            <button type="button" class="teacher-button" onclick={() => saveManualGrade(question)} disabled={savingGradeQuestionId === String(question.id)}>
                              {savingGradeQuestionId === String(question.id) ? 'Saving…' : 'Save grade'}
                            </button>
                          </div>
                        {:else if answer?.points_awarded != null}
                          <p class="review-auto-grade">Auto-graded: {answer.points_awarded} / {question.points}</p>
                        {/if}
                      </article>
                    {/each}
                    {#if gradeMessage}<p class="teacher-success" role="status">{gradeMessage}</p>{/if}
                    {#if gradeError}<p class="teacher-error" role="alert">{gradeError}</p>{/if}
                  </section>
                {/if}
              </section>
            {/if}
          </section>
        {/if}
        {#if !currentInstituteId}
          <p class="teacher-profile-hint" role="status">
            Select an institute in your <a href="/onboarding/">learning profile</a> before creating quizzes.
          </p>
        {/if}
        {#if filteredQuizzes.length}
          <div class="teacher-quiz-list teacher-quiz-library" aria-label="Your quizzes">
            <div class="quiz-library-header" aria-hidden="true">
              <span>Name</span><span>Duration</span><span>Groups</span><span>Created</span>
            </div>
            {#each filteredQuizzes as quiz (quiz.id)}
              <article class="teacher-quiz-row">
                <button type="button" class="quiz-file-open" onclick={() => (activeQuiz = quiz)} aria-label={`Edit ${quiz.title}`}>
                  <span class="quiz-file-name">
                  <span class="quiz-file-icon" aria-hidden="true">Q</span>
                  <div><h4>{quiz.title}</h4><p>Quiz</p></div>
                  </span>
                  <span class="quiz-file-duration">{quiz.duration_minutes} min</span>
                  <span class="quiz-file-groups">{quiz.group_ids?.length || 0} groups</span>
                  <span class="quiz-file-date">{new Date(quiz.created_at).toLocaleDateString()}</span>
                </button>
                <button type="button" class="quiz-schedule-button" onclick={() => openScheduleDialog(quiz)}>
                  Schedule <span aria-hidden="true">↗</span>
                </button>
              </article>
            {/each}
          </div>
        {:else if quizSearch.trim()}
          <div class="teacher-empty">
            <h4>No quizzes match “{quizSearch.trim()}”.</h4>
            <p>Try another title or clear your search.</p>
            <button type="button" class="teacher-inline-link" onclick={() => (quizSearch = '')}>Clear search</button>
          </div>
        {:else}
          <div class="teacher-empty teacher-quiz-empty">
            <span class="quiz-empty-mark" aria-hidden="true">Q</span>
            <h3>Your quiz library is ready.</h3>
            <p>Create a quiz, then choose which of your groups can take it. You can also organize classes or browse institute groups above.</p>
            <button type="button" class="teacher-button" onclick={startQuizCreation} disabled={!currentInstituteId}>
              Create your first quiz <span aria-hidden="true">→</span>
            </button>
          </div>
        {/if}

      {:else if quizStep === 'create'}
        <div class="teacher-quiz-create">
          <div class="teacher-panel-copy">
            <button type="button" class="teacher-back" onclick={() => (quizStep = 'library')}>← Quiz library</button>
            <h3>Create a quiz</h3>
            <p>Start with a title and time limit. You can add questions in the quiz editor later.</p>
          </div>
          <form class="teacher-form" onsubmit={createQuiz}>
            {#if !currentInstituteId}
              <p class="teacher-error" role="alert">
                Complete your institute profile before creating a quiz.
                <a href="/onboarding/">Set up your profile →</a>
              </p>
            {/if}
            <label>
              <span>Quiz title</span>
              <input bind:value={quizTitle} required maxlength="200" placeholder="e.g. Cell biology review" />
            </label>
            <label>
              <span>Duration</span>
              <div class="duration-input">
                <input bind:value={quizDuration} type="number" min="1" step="1" required />
                <span>minutes</span>
              </div>
            </label>
            {#if quizError}<p class="teacher-error" role="alert">{quizError}</p>{/if}
            <button type="submit" class="teacher-button" disabled={savingQuiz || !currentInstituteId || !quizTitle.trim() || !Number(quizDuration)}>
              {savingQuiz ? 'Creating…' : 'Create quiz'} <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      {:else if quizStep === 'groups'}
        <div class="quiz-setup">
          <div class="quiz-setup-heading">
            <button type="button" class="teacher-back" onclick={() => (quizStep = 'create')}>← Back</button>
            <h3>Choose who can take it</h3>
            <p><strong>{createdQuiz?.title}</strong> · {createdQuiz?.duration_minutes} minutes</p>
          </div>
          {#if !currentInstituteId}
            <p class="teacher-error" role="alert">Your teacher profile has no institute. Set it up before assigning groups.</p>
            <a class="teacher-inline-link" href="/onboarding/">Complete your institute profile →</a>
          {:else}
            <div class="group-picker">
              <label class="teacher-search-field">
                <span>Find a group you created</span>
                <input bind:value={groupSearch} placeholder="Search your groups…" />
              </label>
              <div class="selected-group-tags" aria-label="Selected groups">
                {#each ownGroups.filter((group) => selectedGroupIds.includes(String(group.id))) as group (group.id)}
                  <button type="button" class="selected-group-tag" onclick={() => toggleQuizGroup(group.id)}>
                    {groupLabel(group)} <span aria-hidden="true">×</span>
                  </button>
                {:else}
                  <p>No groups selected. This quiz will not be visible to students until you assign a group.</p>
                {/each}
              </div>
              <div class="group-choice-list">
                {#each filteredAssignableGroups as group (group.id)}
                  <button
                    type="button"
                    class="group-choice"
                    class:group-chosen={selectedGroupIds.includes(String(group.id))}
                    onclick={() => toggleQuizGroup(group.id)}
                  >
                    <span class="group-choice-mark">{selectedGroupIds.includes(String(group.id)) ? '✓' : '+'}</span>
                    <span><strong>{groupLabel(group)}</strong><small>{group.member_count || 0} students · {group.is_public ? 'Public' : 'Private'}</small></span>
                  </button>
                {:else}
                  <p class="teacher-empty-line">No created groups match. Create a group now or save the quiz without a group.</p>
                {/each}
              </div>
              <button type="button" class="teacher-inline-link" onclick={() => startGroupCreation('quiz')}>+ Create a group</button>
            </div>
            {#if quizError}<p class="teacher-error" role="alert">{quizError}</p>{/if}
            <div class="quiz-setup-actions">
              <button type="button" class="teacher-secondary" onclick={beginAnotherQuiz}>Discard setup</button>
              <button type="button" class="teacher-button" onclick={saveQuizGroups} disabled={savingQuiz}>
                {savingQuiz ? 'Saving…' : selectedGroupIds.length ? 'Save quiz and groups' : 'Save without groups'} <span aria-hidden="true">→</span>
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="quiz-created-state">
          <span class="created-check" aria-hidden="true">✓</span>
          <div><h3>Quiz saved</h3><p>{createdQuiz?.title} is in your quiz library.</p></div>
          <div class="quiz-created-actions">
            <button type="button" class="teacher-secondary" onclick={() => openScheduleDialog(createdQuiz)}>Schedule exam</button>
            <button type="button" class="teacher-secondary" onclick={() => (activeQuiz = createdQuiz)}>Open quiz editor</button>
            <button type="button" class="teacher-secondary" onclick={beginAnotherQuiz}>Back to quiz library</button>
            <button type="button" class="teacher-button" onclick={startQuizCreation}>Create another quiz</button>
          </div>
        </div>
      {/if}
    {:else if tab === 'my-groups'}
      <div class="teacher-list-heading">
        <div><h3>Groups you created</h3><p>Only groups you manage can be assigned to your quizzes.</p></div>
        <button type="button" class="teacher-button" onclick={() => startGroupCreation('library')}>Create group <span aria-hidden="true">+</span></button>
      </div>
      <label class="teacher-search-field group-library-search">
        <span>Search created groups</span>
        <input bind:value={groupSearch} placeholder="Group name…" />
      </label>
      {#if memberGroupId}
        {@const currentGroup = ownGroups.find((group) => String(group.id) === memberGroupId)}
        <div class="member-panel">
          <div class="member-panel-heading">
            <div><button type="button" class="teacher-back" onclick={() => (memberGroupId = '')}>← Groups</button><h3>{currentGroup?.group_name}</h3></div>
            <span>{groupMembers.length} members</span>
          </div>
          {#if membersLoading}<p role="status">Loading members…</p>
          {:else if membersError}<p class="teacher-error" role="alert">{membersError}</p>
          {:else if groupMembers.length}
            <ul class="member-list">
              {#each groupMembers as member (member.user_id)}
                <li><span><strong>{member.username}</strong><small>{member.email}</small></span><button type="button" onclick={() => removeMember(member)} aria-label={`Remove ${member.username}`}>Remove</button></li>
              {/each}
            </ul>
          {:else}<p class="teacher-empty-line">No students in this group yet.</p>{/if}
          <label class="teacher-search-field">
            <span>Add students from your institute</span>
            <input value={memberSearchText} oninput={searchMembers} placeholder="Search by name, username, email or university UID…" />
          </label>
          {#if memberSearchLoading}<p class="teacher-empty-line" role="status">Searching…</p>{/if}
          {#if memberSearchError}<p class="teacher-error" role="alert">{memberSearchError}</p>{/if}
          {#if availableMemberMatches.length}
            <div class="student-search-results">
              {#each availableMemberMatches as student (student.user_id)}
                <button type="button" onclick={() => addMember(student)}>
                  <span><strong>{student.acc_name}</strong><small>{student.email} · UID {student.institute_member_number || 'not set'}</small></span><span>+ Add</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if filteredOwnGroups.length}
        <div class="teacher-group-list">
          {#each filteredOwnGroups as group (group.id)}
            <article class="teacher-group-row">
              <div class="teacher-group-symbol" aria-hidden="true">{group.group_name.slice(0, 1).toUpperCase()}</div>
              <div class="teacher-group-copy"><h4>{group.group_name}</h4><p>{group.member_count || 0} students · {group.is_public ? 'Visible to institute' : 'Private'}</p></div>
              <button type="button" class="quiet-action" onclick={() => showMembers(group)}>Students <span aria-hidden="true">→</span></button>
              <button type="button" class="group-delete" onclick={() => deleteGroup(group)} aria-label={`Delete ${group.group_name}`}>Delete</button>
            </article>
          {/each}
        </div>
      {:else}
        <div class="teacher-empty"><h4>No groups yet.</h4><p>Create a class group to organize students and assign quizzes.</p><button class="teacher-inline-link" type="button" onclick={() => startGroupCreation('library')}>Create your first group →</button></div>
      {/if}
    {:else}
      <div class="teacher-list-heading">
        <div><h3>Public institute groups</h3><p>Groups shared by teachers in your institute.</p></div>
      </div>
      <label class="teacher-search-field group-library-search">
        <span>Search institute groups</span>
        <input bind:value={groupSearch} placeholder="Group name…" />
      </label>
      {#if filteredPublicGroups.length}
        <div class="teacher-group-list">
          {#each filteredPublicGroups as group (group.id)}
            <article class="teacher-group-row">
              <div class="teacher-group-symbol" aria-hidden="true">{group.group_name.slice(0, 1).toUpperCase()}</div>
              <div class="teacher-group-copy"><h4>{group.group_name}</h4><p>{group.member_count || 0} students · By {group.created_by_username || 'another teacher'}</p></div>
              <span class="public-group-note">Institute group</span>
            </article>
          {/each}
        </div>
      {:else}
        <div class="teacher-empty"><h4>No public groups to show.</h4><p>Public groups in your institute will appear here.</p></div>
      {/if}
    {/if}
  </section>
  {/if}
{/if}

{#if groupDialog}
  <div class="teacher-dialog-backdrop">
    <div class="teacher-dialog" bind:this={groupDialogElement} role="dialog" aria-modal="true" aria-labelledby="create-group-title" tabindex="-1">
      <header class="teacher-dialog-heading"><div><h2 id="create-group-title">Create a group</h2><p>Groups are automatically placed in your institute.</p></div><button type="button" class="dialog-close" onclick={closeGroupDialog} aria-label="Close">×</button></header>
      {#if !currentInstituteId}
        <p class="teacher-error" role="alert">Your profile needs an institute before you can create a group. <a href="/onboarding/">Complete your profile</a>.</p>
      {:else}
        <form class="teacher-form" onsubmit={createGroup}>
          <label><span>Group name</span><input bind:value={groupName} required maxlength="255" placeholder="e.g. Biology 101" /></label>
          <label class="public-toggle"><input type="checkbox" bind:checked={groupIsPublic} /><span><strong>Make this group visible</strong><small>Students in your institute can discover public groups.</small></span></label>
          <label class="teacher-search-field">
            <span>Add students <small>Optional</small></span>
            <input value={groupSearchText} oninput={searchStudents} placeholder="Search name, username, email or university UID…" />
          </label>
          <p class="search-hint">
            Searching {profile?.institute_name || profile?.institute?.institute_name || 'students in your institute'}.
            Type at least two characters; results are limited to 30.
          </p>
          {#if studentSearchLoading}<p class="teacher-empty-line" role="status">Searching institute students…</p>{/if}
          {#if studentSearchError}<p class="teacher-error" role="alert">{studentSearchError}</p>{/if}
          {#if studentMatches.length}
            <div class="student-search-results">
              {#each studentMatches as student (studentId(student))}
                <button type="button" class:student-picked={selectedStudents.some((item) => studentId(item) === studentId(student))} onclick={() => toggleStudent(student)}>
                  <span><strong>{studentName(student)}</strong><small>{student.username ? `@${student.username} · ` : ''}{student.email || 'No email'} · UID {student.institute_member_number || 'not set'}</small></span>
                  <span>{selectedStudents.some((item) => studentId(item) === studentId(student)) ? 'Selected ✓' : '+ Add'}</span>
                </button>
              {/each}
            </div>
          {:else if studentSearchCompleted && !studentSearchLoading}
            <p class="teacher-search-feedback" role="status">
              No matching students. Only students with a completed profile at your institute appear here. Check the name or UID, and confirm the student selected the same institute during onboarding.
            </p>
          {:else if groupSearchText.trim().length >= 2 && !studentSearchLoading && !studentSearchError}
            <p class="teacher-search-feedback" role="status">Preparing student search…</p>
          {/if}

          {#if selectedStudents.length}
            <div class="student-pills" aria-label="Selected students">
              {#each selectedStudents as student (studentId(student))}
                <button type="button" onclick={() => toggleStudent(student)}>{studentName(student)}<span aria-hidden="true">×</span></button>
              {/each}
            </div>
          {/if}

          {#if groupError}<p class="teacher-error" role="alert">{groupError}</p>{/if}
          {#if groupMessage}<p class="teacher-success" role="status">{groupMessage}</p>{/if}
          <footer class="teacher-dialog-actions"><button type="button" class="teacher-secondary" onclick={closeGroupDialog} disabled={groupSaving}>Cancel</button><button type="submit" class="teacher-button" disabled={groupSaving}>{groupSaving ? 'Creating…' : selectedStudents.length ? `Create group · add ${selectedStudents.length} students` : 'Create group'}</button></footer>
        </form>
      {/if}
    </div>
  </div>
{/if}

{#if sessionDialog}
  {@const selectedQuiz = quizzes.find((quiz) => String(quiz.id) === sessionQuizId)}
  <div class="teacher-dialog-backdrop">
    <div
      class="teacher-dialog session-dialog"
      bind:this={sessionDialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-dialog-title"
      tabindex="-1"
      onkeydown={handleSessionDialogKeydown}
    >
      <header class="teacher-dialog-heading">
        <div>
          <h2 id="session-dialog-title">{editingSessionId ? 'Edit exam schedule' : 'Schedule an exam'}</h2>
          <p>{selectedQuiz?.title || 'Set when students can take this quiz.'}</p>
        </div>
        <button type="button" class="dialog-close" onclick={closeSessionDialog} aria-label="Close">×</button>
      </header>
      {#if selectedQuiz && !(selectedQuiz.group_ids || []).length}
        <p class="session-access-note">No groups are assigned to this quiz yet. Students will not see this session until you assign the quiz to one or more groups.</p>
      {/if}
      <form class="teacher-form" onsubmit={saveSession}>
        <label>
          <span>Opens</span>
          <input bind:value={sessionStartTime} type="datetime-local" required />
        </label>
        <label>
          <span>Closes</span>
          <input bind:value={sessionEndTime} type="datetime-local" required />
        </label>
        {#if selectedQuiz?.allow_multiple_attempts}
          <label>
            <span>Allowed attempts</span>
            <div class="duration-input">
              <input bind:value={sessionMaxAttempts} type="number" min="1" step="1" required />
              <span>per student</span>
            </div>
          </label>
        {:else}
          <p class="session-access-note">This quiz currently allows one attempt per student. Enable multiple attempts in the quiz editor to change this.</p>
        {/if}
        {#if sessionError}<p class="teacher-error" role="alert">{sessionError}</p>{/if}
        <div class="teacher-dialog-actions">
          <button type="button" class="teacher-secondary" onclick={closeSessionDialog} disabled={sessionSaving}>Keep editing later</button>
          <button type="submit" class="teacher-button" disabled={sessionSaving}>
            {sessionSaving ? 'Saving…' : editingSessionId ? 'Save schedule' : 'Schedule exam'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
