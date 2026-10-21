import { mount } from 'svelte';
import HomePage from './pages/landing/HomePage.svelte';
import '../style.css';

mount(HomePage, {
  target: document.getElementById('app')
});