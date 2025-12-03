from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView
from .auth_serializers import MyTokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework.response import Response

class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = MyTokenObtainPairSerializer


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)


class CurrentUserView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.get_username(),
            "email": getattr(user, "email", "")
        })