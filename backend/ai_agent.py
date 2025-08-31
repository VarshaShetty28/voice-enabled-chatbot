#ai_agent.py

# Step 0: Setup API Keys

import os

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Step 1: Import LLMs and Tools

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langgraph.prebuilt import create_react_agent
from langchain_core.messages.ai import AIMessage


# Step 2: Define system prompt

system_prompt_default = "Act as an AI chatbot who is smart and friendly"


# Step 3: AI Agent Function

def get_response_from_ai_agent(llm_id, user_messages, allow_search, system_prompt, provider):
    # Initialize LLM based on provider
    if provider == "Groq":
        llm = ChatGroq(model=llm_id)
    elif provider == "OpenAI":
        llm = ChatOpenAI(model=llm_id)
    else:
        raise ValueError("Invalid provider")

    # Initialize search tool if allowed
    tools = [TavilySearch(max_results=2)] if allow_search else []

    # Create AI agent
    agent = create_react_agent(model=llm, tools=tools)

    # Prepare query messages
    state = {
        "messages": [
            {"role": "system", "content": system_prompt},
        ] + [{"role": "user", "content": msg} for msg in user_messages]
    }

    # Invoke agent
    response = agent.invoke(state)
    messages = response.get("messages", [])
    ai_messages = [message.content for message in messages if isinstance(message, AIMessage)]

    return ai_messages[-1] if ai_messages else "No response from agent."

# Step 4: Setup Pydantic Model

from pydantic import BaseModel
from typing import List

class RequestState(BaseModel):
    model_name: str
    model_provider: str
    system_prompt: str
    messages: List[str]
    allowed_search: bool


# Step 5: FastAPI Backend

from fastapi import FastAPI

ALLOWED_MODEL_NAMES = ["llama3-70b-8192", "mixtral-8x7b-32768", "llama-3.3-70b-versatile", "gpt-4o-mini"]

app = FastAPI(title="LangGraph AI Agent")

@app.post("/chat")
def chat_endpoint(request: RequestState):
    if request.model_name not in ALLOWED_MODEL_NAMES:
        return {"error": "Invalid model name. Kindly select a valid AI model"}
    
    response = get_response_from_ai_agent(
        llm_id=request.model_name,
        user_messages=request.messages,
        allow_search=request.allowed_search,
        system_prompt=request.system_prompt,
        provider=request.model_provider
    )
    return {"response": response}


# Step 6: Run FastAPI App

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9999)