import { mount } from 'svelte';
import OnboardingPage from './OnboardingPage.svelte';
import '../../../style.css';
import './OnboardingPage.css';

mount(OnboardingPage, {
  target: document.getElementById('app')
});
