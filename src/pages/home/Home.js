import { mount } from 'svelte';
import Home from './Home.svelte';
import '../../../style.css';
import './Home.css';
import './TeacherWorkspace.css';
import './QuizEditor.css';

mount(Home, {
  target: document.getElementById('app')
});
