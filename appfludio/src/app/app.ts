import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotesComponent } from './notes/notes.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,
    NotesComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('appfludio');
}
