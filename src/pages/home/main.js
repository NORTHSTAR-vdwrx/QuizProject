import { mount } from 'svelte';
import HomePage from '../landing/HomePage.svelte';
import '../../../style.css';

mount(HomePage, {
  target: document.getElementById('app')
});