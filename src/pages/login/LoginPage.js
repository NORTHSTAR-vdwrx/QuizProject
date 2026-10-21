import { mount } from 'svelte';
import HomePage from './LoginPage.svelte';
import '../../../style.css';
import '../auth/AuthPage.css';

mount(HomePage, {
  target: document.getElementById('app')
});