from django.shortcuts import render
from api import views
# Create your views here.
from django.views.generic import TemplateView
from rest_framework import viewsets
from .models import Note
from .serializers import NoteSerializer
from .permissions import IsSuperUserOrReadOnly


class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsSuperUserOrReadOnly]

##class IndexView(TemplateView):
  ##  template_name = 'api/index.html'