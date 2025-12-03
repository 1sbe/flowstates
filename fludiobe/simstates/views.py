from rest_framework import viewsets, permissions
from .models import SimState
from .serializers import SimStateSerializer

class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user

class SimStateViewSet(viewsets.ModelViewSet):
    serializer_class = SimStateSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        # only return the logged-in user's states
        return SimState.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)