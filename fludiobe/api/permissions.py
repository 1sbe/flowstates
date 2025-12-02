# In your_app/permissions.py
from rest_framework import permissions

class IsSuperUserOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow superusers to perform write operations (POST, PUT, PATCH).
    All users can perform safe methods (GET, HEAD, OPTIONS).
    """
    def has_permission(self, request, view):
        # Allow read-only access for all users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Allow write access only for superusers
        return request.user and request.user.is_authenticated and request.user.is_superuser