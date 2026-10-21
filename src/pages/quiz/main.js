import { mount } from 'svelte';
import QuizPage from './QuizPage.svelte';
import '../../../style.css';

mount(QuizPage, {
  target: document.getElementById('app')
});