import { mount } from 'svelte';
import HomePage from './pages/landing/LandingPage.svelte';
import '../style.css';
import './pages/landing/LandingPage.css';


mount(HomePage, {
  target: document.getElementById('app')
});