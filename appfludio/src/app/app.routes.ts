import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'notes',
    loadComponent: () =>
      import('./notes/notes.component').then(
        (c) => c.NotesComponent
      ),
    title: "notes"
  }
];
