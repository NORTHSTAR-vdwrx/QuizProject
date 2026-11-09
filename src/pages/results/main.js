import { mount } from 'svelte';
import ResultsPage from './ResultsPage.svelte';
import '../../../style.css';
import './ResultsPage.css';

mount(ResultsPage, {
  target: document.getElementById('app')
});