import { mount } from 'svelte';
import Home from './Home.svelte';
import '../home/style.css';

mount(Home, {
  target: document.getElementById('app')
});
