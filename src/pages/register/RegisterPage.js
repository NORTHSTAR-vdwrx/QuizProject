import { mount } from 'svelte';
import RegisterPage from './RegisterPage.svelte';
import '../../../style.css';
import '../auth/AuthPage.css';

mount(RegisterPage, {
  target: document.getElementById('app')
});
