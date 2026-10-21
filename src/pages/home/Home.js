import { mount } from 'svelte';
import Home from './Home.svelte';
import '../../../style.css';
import '../home/Home.css';

mount(Home, {
  target: document.getElementById('app')
});
