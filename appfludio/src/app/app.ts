import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotesComponent } from './notes/notes.component';
import { ArtFluidComponent } from './art-fluid/art-fluid.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,
    NotesComponent,
    ArtFluidComponent    
  ],
  templateUrl: './app.html',
  
  styleUrl: './app.scss'
  
})
export class App {
  protected readonly title = signal('Flowstates: Full Stack Fluid Sim');
}
