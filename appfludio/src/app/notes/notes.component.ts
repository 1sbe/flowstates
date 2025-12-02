import { Component, OnInit } from '@angular/core';
import { NoteService } from '../note.service';
import { Note } from '../note.model';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss']
})
export class NotesComponent implements OnInit {
  notes: Note[] = [];

  constructor(private noteService: NoteService) {}

  ngOnInit(): void {
    this.noteService.getNotes().subscribe((data: Note[]) => {
      this.notes = data;
    });
  }

  addNote(title: string, content: string): void {
    const newNote: Note = { title, content } as Note;
    this.noteService.addNote(newNote).subscribe((note) => {
      this.notes.push(note);
    });
  }
}